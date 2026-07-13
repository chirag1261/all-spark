import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { confirmSeats, getBooking, releaseSeats, saveBooking } from "@/lib/store";
import { generateTicketId, ticketQrDataUrl } from "@/lib/ticket";
import { sendTicketEmail } from "@/lib/email";

/**
 * POST /api/verify
 * Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
 *
 * Verifies the Razorpay payment signature (HMAC-SHA256 of "order_id|payment_id"
 * with the key secret). Only a valid signature confirms the booking —
 * the client's word is never trusted.
 */
export async function POST(req: NextRequest) {
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) {
    return NextResponse.json({ error: "Payment gateway not configured" }, { status: 500 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const orderId = body.razorpay_order_id;
  const paymentId = body.razorpay_payment_id;
  const signature = body.razorpay_signature;

  if (
    typeof orderId !== "string" ||
    typeof paymentId !== "string" ||
    typeof signature !== "string" ||
    !orderId ||
    !paymentId ||
    !signature
  ) {
    return NextResponse.json({ error: "Missing payment fields" }, { status: 400 });
  }

  const booking = getBooking(orderId);
  if (!booking) {
    return NextResponse.json({ error: "Unknown order" }, { status: 404 });
  }

  // Idempotency: verifying the same successful payment twice returns the
  // same booking and the SAME ticket — and does not resend the email.
  if (booking.status === "CONFIRMED") {
    return NextResponse.json({
      status: "CONFIRMED",
      bookingId: booking.bookingId,
      ticketId: booking.ticketId,
      qrDataUrl: booking.ticketId ? await ticketQrDataUrl(booking, booking.ticketId) : null,
      seats: booking.seatIds,
      amount: booking.amount,
      emailSent: booking.emailSent ?? false,
    });
  }

  const expected = crypto
    .createHmac("sha256", keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

  const sigBuf = Buffer.from(signature, "utf8");
  const expBuf = Buffer.from(expected, "utf8");
  const valid = sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf);

  if (!valid) {
    // Tampered or failed payment — release the seats.
    releaseSeats(booking.showId, orderId);
    saveBooking({ ...booking, status: "FAILED" });
    return NextResponse.json({ error: "Payment verification failed" }, { status: 400 });
  }

  confirmSeats(booking.showId, booking.seatIds, orderId);

  // ---- Ticket generation ----
  const ticketId = generateTicketId();
  const confirmed = {
    ...booking,
    status: "CONFIRMED" as const,
    razorpayPaymentId: paymentId,
    ticketId,
  };
  saveBooking(confirmed);

  // Email failure must never fail a paid booking — the ticket is still
  // shown on screen and the response says the email didn't go out.
  const email = await sendTicketEmail(confirmed, ticketId);
  saveBooking({ ...confirmed, emailSent: email.sent });

  return NextResponse.json({
    status: "CONFIRMED",
    bookingId: booking.bookingId,
    ticketId,
    qrDataUrl: await ticketQrDataUrl(confirmed, ticketId),
    seats: booking.seatIds,
    amount: booking.amount,
    emailSent: email.sent,
  });
}
