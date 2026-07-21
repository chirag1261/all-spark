import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import Razorpay from "razorpay";

import { MAX_SEATS_PER_BOOKING } from "@/constants";
import { getCurrentCustomer } from "@/lib/auth/customer";
import { getEvent, lockSeats, releaseSeats, saveBooking } from "@/lib/db";
import { isValidSeatId, registrationState, seatPrice } from "@/lib/domain/events";
import { releaseToken } from "@/lib/domain/tickets";
import { clientKey, rateLimit } from "@/lib/http/ratelimit";
import { BookingAttendee } from "@/types";

/**
 * POST /api/orders
 * Body: { eventId: string, attendees: [{ seatId, name }, ...] }
 *
 * Requires a signed-in customer — the booking's contact details come from
 * their VERIFIED profile, never from free-form input. Each seat carries its
 * attendee's name (individual QR tickets are minted on confirmation).
 * Locks the seats, computes the amount SERVER-SIDE from the ticket categories
 * (client-sent amounts are never trusted), and creates a Razorpay order.
 */
export async function POST(req: NextRequest) {
  // Mandatory login before purchase — enforced here, not just in the UI.
  const customer = await getCurrentCustomer();
  if (!customer) {
    return NextResponse.json({ error: "Please sign in to book tickets" }, { status: 401 });
  }

  // Seat locks are a scarce resource — rate-limit to stop scripted hoarding.
  if (!rateLimit(`orders:${clientKey(req)}`, 10, 60_000)) {
    return NextResponse.json(
      { error: "Too many booking attempts — please wait a minute and retry" },
      { status: 429 }
    );
  }

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    return NextResponse.json(
      { error: "Payment gateway is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET." },
      { status: 500 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { eventId } = body;

  // ---- Input validation ----
  if (typeof eventId !== "string" || !eventId) {
    return NextResponse.json({ error: "eventId is required" }, { status: 400 });
  }
  const event = await getEvent(eventId);
  if (!event || !event.published) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  if (!Array.isArray(body.attendees) || body.attendees.length === 0) {
    return NextResponse.json({ error: "Select at least one seat" }, { status: 400 });
  }
  if (body.attendees.length > MAX_SEATS_PER_BOOKING) {
    return NextResponse.json(
      { error: `Maximum ${MAX_SEATS_PER_BOOKING} seats per booking` },
      { status: 400 }
    );
  }

  const attendees: BookingAttendee[] = [];
  for (const raw of body.attendees as Array<Record<string, unknown>>) {
    const seatId = typeof raw?.seatId === "string" ? raw.seatId.toUpperCase().trim() : "";
    const name = typeof raw?.name === "string" ? raw.name.trim() : "";
    if (!seatId || !isValidSeatId(event, seatId)) {
      return NextResponse.json({ error: `Invalid seat: ${seatId || "?"}` }, { status: 400 });
    }
    if (name.length < 2 || name.length > 80) {
      return NextResponse.json(
        { error: `Enter the attendee's name for seat ${seatId}` },
        { status: 400 }
      );
    }
    attendees.push({ seatId, name });
  }
  const seatIds = attendees.map((a) => a.seatId);
  if (new Set(seatIds).size !== seatIds.length) {
    return NextResponse.json({ error: "Duplicate seats in selection" }, { status: 400 });
  }

  // ---- Registration window ----
  const reg = registrationState(event);
  if (reg === "upcoming") {
    return NextResponse.json({ error: "Registration has not opened yet" }, { status: 409 });
  }
  if (reg === "closed") {
    return NextResponse.json({ error: "Registration for this event has closed" }, { status: 409 });
  }

  // ---- Server-side amount computation ----
  const amount = seatIds.reduce((sum, seatId) => sum + (seatPrice(event, seatId) ?? 0), 0);

  // ---- Lock seats BEFORE creating the payment order ----
  // A provisional lock key ties the lock to the order we're about to create.
  const provisionalId = `prov_${crypto.randomUUID()}`;
  const lock = await lockSeats(eventId, seatIds, provisionalId);
  if (!lock.ok) {
    return NextResponse.json(
      { error: "Some seats were just taken", conflicts: lock.conflicts },
      { status: 409 }
    );
  }

  try {
    const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
    const order = await razorpay.orders.create({
      amount,
      currency: "INR",
      receipt: `evt_${Date.now()}`,
      notes: { eventId, seats: seatIds.join(",") },
    });

    // Re-key the lock from the provisional id to the real order id.
    await releaseSeats(eventId, provisionalId);
    const relock = await lockSeats(eventId, seatIds, order.id);
    if (!relock.ok) {
      // Practically unreachable (we held the lock), but never leave an order dangling.
      return NextResponse.json({ error: "Seat lock lost, please retry" }, { status: 409 });
    }

    await saveBooking({
      bookingId: `BKG${Date.now()}`,
      eventId,
      customerId: customer.id,
      seatIds,
      attendees,
      amount,
      razorpayOrderId: order.id,
      status: "PENDING",
      attendeeName: customer.name,
      customerEmail: customer.email ?? "",
      customerPhone: customer.phone ?? "",
      createdAt: Date.now(),
    });

    return NextResponse.json({
      orderId: order.id,
      amount,
      currency: "INR",
      keyId, // publishable key for Checkout.js
      releaseToken: releaseToken(order.id), // required to voluntarily release the hold
      prefill: { name: customer.name, email: customer.email ?? "", contact: customer.phone ?? "" },
    });
  } catch (err) {
    // Razorpay order creation failed — release the locks so seats aren't stranded.
    await releaseSeats(eventId, provisionalId);
    console.error("Razorpay order creation failed:", err);
    return NextResponse.json(
      { error: "Could not initiate payment. Please try again." },
      { status: 502 }
    );
  }
}
