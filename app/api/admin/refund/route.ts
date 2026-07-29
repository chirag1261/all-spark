import { NextRequest, NextResponse } from "next/server";
import Razorpay from "razorpay";

import { getCurrentAdmin } from "@/lib/auth/admin";
import { audit, getBooking, getEvent, saveBooking, unbookSeats } from "@/lib/db";
import { refundEligibility } from "@/lib/domain/events";
import { logger } from "@/lib/logger";
import { inr } from "@/utils";

/**
 * POST /api/admin/refund
 * Body: { orderId }
 *
 * Issues a Razorpay refund for a confirmed booking, marks it REFUNDED and
 * returns its seats to the available pool. The refund amount follows the
 * Refund & Cancellation Policy's cancellation window, measured against the
 * event's start time: 70% (30% cancellation charge) more than 7 days out,
 * 50% from 7 days down to 48 hours out, and blocked entirely inside the
 * final 48 hours (no refund at all).
 *
 * NOTE: this is the customer-cancellation path. An organiser-cancelled event
 * (always a full refund regardless of timing, per policy) isn't automated
 * here — that's a manual exception for a super admin to apply directly.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "super_admin") {
    return NextResponse.json({ error: "Only super admins can issue refunds" }, { status: 403 });
  }

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    return NextResponse.json({ error: "Payment gateway not configured" }, { status: 500 });
  }

  let body: { orderId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (typeof body.orderId !== "string" || !body.orderId) {
    return NextResponse.json({ error: "orderId is required" }, { status: 400 });
  }

  const booking = await getBooking(body.orderId);
  if (!booking) return NextResponse.json({ error: "Unknown order" }, { status: 404 });
  if (booking.status === "REFUNDED") {
    return NextResponse.json({ error: "Booking is already refunded" }, { status: 409 });
  }
  if (booking.status !== "CONFIRMED" || !booking.razorpayPaymentId) {
    return NextResponse.json({ error: "Only confirmed bookings can be refunded" }, { status: 409 });
  }

  const event = await getEvent(booking.eventId);
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  const eligibility = refundEligibility(event.startsAt);
  if (!eligibility.allowed) {
    return NextResponse.json(
      { error: "Refunds can no longer be requested — the event starts in less than 48 hours." },
      { status: 409 }
    );
  }
  const refundAmount = Math.round(booking.amount * eligibility.fraction);

  try {
    const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
    const refund = await razorpay.payments.refund(booking.razorpayPaymentId, {
      amount: refundAmount,
      speed: "normal",
      notes: {
        bookingId: booking.bookingId,
        reason: "Admin-initiated refund",
        fraction: String(eligibility.fraction),
      },
    });

    await saveBooking({ ...booking, status: "REFUNDED", razorpayRefundId: refund.id });
    await unbookSeats(booking.eventId, booking.seatIds);
    await audit(
      "booking.refund",
      "booking",
      booking.bookingId,
      `Refunded ${inr(refundAmount)} (${eligibility.fraction * 100}% of ${inr(booking.amount)}) to ${booking.customerEmail} (seats ${booking.seatIds.join(", ")})`
    );
    logger.be.info("Refund issued", {
      bookingId: booking.bookingId,
      amount: refundAmount,
      fraction: eligibility.fraction,
      refundId: refund.id,
    });

    return NextResponse.json({ refunded: true, refundId: refund.id, amount: refundAmount });
  } catch (err) {
    console.error("Refund failed:", err);
    logger.be.error("Refund failed", { bookingId: body.orderId, err: String(err) });
    const msg =
      (err as { error?: { description?: string } })?.error?.description ??
      "Refund failed at the payment gateway";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
