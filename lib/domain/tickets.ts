import crypto from "crypto";
import QRCode from "qrcode";

import { sessionSecret } from "@/lib/auth/secret";
import { createTickets, listTicketsForBooking } from "@/lib/db";
import { Booking, TicketRecord } from "@/types";

/**
 * Unique, unguessable ticket number: TKT-XXXX-XXXX-XXXX
 * (crypto-random, unambiguous alphabet — no 0/O/1/I).
 */
export function generateTicketId(): string {
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  const bytes = crypto.randomBytes(12);
  let out = "";
  for (let i = 0; i < 12; i++) {
    out += alphabet[bytes[i] % alphabet.length];
    if (i === 3 || i === 7) out += "-";
  }
  return `TKT-${out}`;
}

/**
 * Mints one ticket per attendee/seat for a confirmed booking. Idempotent:
 * if the booking already has tickets (verify replay, webhook after handler),
 * the existing ones are returned unchanged — no duplicate tickets ever.
 */
export async function ensureTicketsForBooking(booking: Booking): Promise<TicketRecord[]> {
  const existing = await listTicketsForBooking(booking.bookingId);
  if (existing.length > 0) return existing;

  // Legacy bookings (before per-attendee details) fall back to the purchaser's
  // name on every seat, so they still get one QR per seat.
  const attendees =
    booking.attendees.length > 0
      ? booking.attendees
      : booking.seatIds.map((seatId) => ({ seatId, name: booking.attendeeName }));

  const now = Date.now();
  const tickets: TicketRecord[] = attendees.map((a) => ({
    ticketId: generateTicketId(),
    bookingId: booking.bookingId,
    eventId: booking.eventId,
    seatId: a.seatId,
    attendeeName: a.name,
    createdAt: now,
  }));
  await createTickets(tickets);
  // Re-read instead of trusting our local array: if two confirmations raced,
  // ON CONFLICT means exactly one set won — return whatever is durable.
  return listTicketsForBooking(booking.bookingId);
}

/**
 * QR payload a scanner at the venue gate would verify — one per attendee.
 * Deterministic for a ticket, so regenerating on a replay yields the same QR.
 */
export function ticketQrPayload(ticket: TicketRecord, booking: Booking): string {
  return JSON.stringify({
    t: ticket.ticketId,
    b: ticket.bookingId,
    e: ticket.eventId,
    seat: ticket.seatId,
    name: ticket.attendeeName,
    p: booking.razorpayPaymentId,
  });
}

export async function ticketQrDataUrl(ticket: TicketRecord, booking: Booking): Promise<string> {
  return QRCode.toDataURL(ticketQrPayload(ticket, booking), {
    width: 280,
    margin: 1,
    errorCorrectionLevel: "M",
  });
}

/**
 * Per-order release token: only the client that created an order (and holds
 * this token) may release its seat locks — an orderId alone is not enough.
 */
export function releaseToken(orderId: string): string {
  return crypto
    .createHmac("sha256", sessionSecret())
    .update(`release:${orderId}`)
    .digest("hex")
    .slice(0, 32);
}
