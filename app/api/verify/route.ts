import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

import { confirmSeats, getBooking, releaseSeats, saveBooking } from "@/lib/db";
import { ensureTicketsForBooking, ticketQrDataUrl } from "@/lib/domain/tickets";
import { sendTicketEmail } from "@/lib/notifications/email";
import { Booking, TicketRecord } from "@/types";

async function ticketsPayload(booking: Booking, tickets: TicketRecord[]) {
  return Promise.all(
    tickets.map(async (t) => ({
      ticketId: t.ticketId,
      seatId: t.seatId,
      name: t.attendeeName,
      qrDataUrl: await ticketQrDataUrl(t, booking),
    }))
  );
}

/**
 * POST /api/verify
 * Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
 *
 * Verifies the Razorpay payment signature (HMAC-SHA256 of "order_id|payment_id"
 * with the key secret). Only a valid signature confirms the booking —
 * the client's word is never trusted. On confirmation, one QR ticket is
 * minted per attendee/seat.
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

  const booking = await getBooking(orderId);
  if (!booking) {
    return NextResponse.json({ error: "Unknown order" }, { status: 404 });
  }

  // Idempotency: verifying the same successful payment twice returns the
  // same booking and the SAME tickets — and does not resend the email.
  if (booking.status === "CONFIRMED") {
    const tickets = await ensureTicketsForBooking(booking);
    return NextResponse.json({
      status: "CONFIRMED",
      bookingId: booking.bookingId,
      tickets: await ticketsPayload(booking, tickets),
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
    await releaseSeats(booking.eventId, orderId);
    await saveBooking({ ...booking, status: "FAILED" });
    return NextResponse.json({ error: "Payment verification failed" }, { status: 400 });
  }

  await confirmSeats(booking.eventId, booking.seatIds, orderId);

  // ---- Per-attendee ticket generation ----
  const confirmed = {
    ...booking,
    status: "CONFIRMED" as const,
    razorpayPaymentId: paymentId,
  };
  const tickets = await ensureTicketsForBooking(confirmed);
  confirmed.ticketId = tickets[0]?.ticketId; // legacy pointer to the first ticket
  await saveBooking(confirmed);

  // Email failure must never fail a paid booking — the tickets are still
  // shown on screen and the response says the email didn't go out.
  const email = await sendTicketEmail(confirmed, tickets, req.nextUrl.origin);
  await saveBooking({ ...confirmed, emailSent: email.sent });

  return NextResponse.json({
    status: "CONFIRMED",
    bookingId: booking.bookingId,
    tickets: await ticketsPayload(confirmed, tickets),
    seats: booking.seatIds,
    amount: booking.amount,
    emailSent: email.sent,
  });
}
