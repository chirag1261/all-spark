import crypto from "crypto";
import QRCode from "qrcode";
import { Booking } from "./types";

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
 * QR payload a scanner at the theatre gate would verify.
 * Deterministic for a booking+ticket pair, so regenerating on a verify
 * replay yields the identical QR.
 */
export function ticketQrPayload(booking: Booking, ticketId: string): string {
  return JSON.stringify({
    t: ticketId,
    b: booking.bookingId,
    s: booking.showId,
    seats: booking.seatIds,
    p: booking.razorpayPaymentId,
  });
}

export async function ticketQrDataUrl(booking: Booking, ticketId: string): Promise<string> {
  return QRCode.toDataURL(ticketQrPayload(booking, ticketId), {
    width: 280,
    margin: 1,
    errorCorrectionLevel: "M",
  });
}
