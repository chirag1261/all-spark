import { NextRequest, NextResponse } from "next/server";
import Razorpay from "razorpay";
import {
  getShowById,
  getSeatTier,
  isValidSeatId,
  todayISO,
  MAX_SEATS_PER_BOOKING,
} from "@/lib/data";
import { lockSeats, releaseSeats, saveBooking } from "@/lib/store";

/**
 * POST /api/orders
 * Body: { showId: string, seatIds: string[], email: string }
 *
 * Locks the seats, computes the amount SERVER-SIDE from the seat tiers
 * (client-sent amounts are never trusted), and creates a Razorpay order.
 */
export async function POST(req: NextRequest) {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    return NextResponse.json(
      { error: "Payment gateway is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET." },
      { status: 500 }
    );
  }

  let body: { showId?: unknown; seatIds?: unknown; email?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { showId, seatIds, email } = body;

  // ---- Input validation ----
  if (typeof showId !== "string" || !showId) {
    return NextResponse.json({ error: "showId is required" }, { status: 400 });
  }
  if (!Array.isArray(seatIds) || seatIds.length === 0) {
    return NextResponse.json({ error: "Select at least one seat" }, { status: 400 });
  }
  if (seatIds.length > MAX_SEATS_PER_BOOKING) {
    return NextResponse.json(
      { error: `Maximum ${MAX_SEATS_PER_BOOKING} seats per booking` },
      { status: 400 }
    );
  }
  if (new Set(seatIds).size !== seatIds.length) {
    return NextResponse.json({ error: "Duplicate seats in selection" }, { status: 400 });
  }
  const invalid = seatIds.filter((s) => typeof s !== "string" || !isValidSeatId(s));
  if (invalid.length > 0) {
    return NextResponse.json({ error: `Invalid seats: ${invalid.join(", ")}` }, { status: 400 });
  }
  if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
  }

  const show = getShowById(showId, todayISO());
  if (!show) {
    return NextResponse.json({ error: "Show not found" }, { status: 404 });
  }

  // Reject shows that have already started.
  const showStart = new Date(`${show.date}T${show.time}:00`);
  if (showStart.getTime() < Date.now()) {
    return NextResponse.json({ error: "This show has already started" }, { status: 409 });
  }

  // ---- Server-side amount computation ----
  const amount = (seatIds as string[]).reduce((sum, seatId) => {
    const tier = getSeatTier(seatId)!;
    return sum + show.priceTiers[tier];
  }, 0);

  // ---- Lock seats BEFORE creating the payment order ----
  // A provisional lock key ties the lock to the order we're about to create.
  const provisionalId = `prov_${crypto.randomUUID()}`;
  const lock = lockSeats(showId, seatIds as string[], provisionalId);
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
      receipt: `bms_${Date.now()}`,
      notes: { showId, seats: (seatIds as string[]).join(",") },
    });

    // Re-key the lock from the provisional id to the real order id.
    releaseSeats(showId, provisionalId);
    const relock = lockSeats(showId, seatIds as string[], order.id);
    if (!relock.ok) {
      // Practically unreachable (we held the lock), but never leave an order dangling.
      return NextResponse.json({ error: "Seat lock lost, please retry" }, { status: 409 });
    }

    saveBooking({
      bookingId: `BMS${Date.now()}`,
      showId,
      seatIds: seatIds as string[],
      amount,
      razorpayOrderId: order.id,
      status: "PENDING",
      customerEmail: email,
      createdAt: Date.now(),
    });

    return NextResponse.json({
      orderId: order.id,
      amount,
      currency: "INR",
      keyId, // publishable key for Checkout.js
    });
  } catch (err) {
    // Razorpay order creation failed — release the locks so seats aren't stranded.
    releaseSeats(showId, provisionalId);
    console.error("Razorpay order creation failed:", err);
    return NextResponse.json(
      { error: "Could not initiate payment. Please try again." },
      { status: 502 }
    );
  }
}
