import { NextRequest, NextResponse } from "next/server";
import Razorpay from "razorpay";

import { getCurrentAdmin } from "@/lib/auth/admin";
import { audit, getBooking, saveBooking, unbookSeats } from "@/lib/db";
import { logger } from "@/lib/logger";
import { inr } from "@/utils";

/**
 * POST /api/admin/refund
 * Body: { orderId }
 *
 * Issues a full Razorpay refund for a confirmed booking, marks it REFUNDED
 * and returns its seats to the available pool.
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

  try {
    const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
    const refund = await razorpay.payments.refund(booking.razorpayPaymentId, {
      amount: booking.amount,
      speed: "normal",
      notes: { bookingId: booking.bookingId, reason: "Admin-initiated refund" },
    });

    await saveBooking({ ...booking, status: "REFUNDED", razorpayRefundId: refund.id });
    await unbookSeats(booking.eventId, booking.seatIds);
    await audit(
      "booking.refund",
      "booking",
      booking.bookingId,
      `Refunded ${inr(booking.amount)} to ${booking.customerEmail} (seats ${booking.seatIds.join(", ")})`
    );
    logger.be.info("Refund issued", { bookingId: booking.bookingId, amount: booking.amount, refundId: refund.id });

    return NextResponse.json({ refunded: true, refundId: refund.id });
  } catch (err) {
    console.error("Refund failed:", err);
    logger.be.error("Refund failed", { bookingId: body.orderId, err: String(err) });
    const msg =
      (err as { error?: { description?: string } })?.error?.description ??
      "Refund failed at the payment gateway";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
