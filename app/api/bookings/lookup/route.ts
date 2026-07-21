import { NextRequest, NextResponse } from "next/server";

import {
  getBookingByBookingId,
  getEvent,
  listTicketsForBooking,
  sweepStalePending,
} from "@/lib/db";
import { clientKey, rateLimit } from "@/lib/http/ratelimit";

/**
 * POST /api/bookings/lookup — Body: { bookingId, email }
 * Public booking-status check. The email must match the booking's, so a
 * booking ID alone (e.g. read over a shoulder) is not enough to fetch it.
 */
export async function POST(req: NextRequest) {
  if (!rateLimit(`lookup:${clientKey(req)}`, 20, 60_000)) {
    return NextResponse.json(
      { error: "Too many lookups — try again in a minute" },
      { status: 429 }
    );
  }

  let body: { bookingId?: unknown; email?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const bookingId = typeof body.bookingId === "string" ? body.bookingId.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!bookingId || !email) {
    return NextResponse.json({ error: "Booking ID and email are required" }, { status: 400 });
  }

  await sweepStalePending();
  const booking = await getBookingByBookingId(bookingId);
  if (!booking || booking.customerEmail.toLowerCase() !== email) {
    // Same response for wrong id and wrong email — don't leak which exists.
    return NextResponse.json({ error: "No booking found for that ID and email" }, { status: 404 });
  }

  const event = await getEvent(booking.eventId);
  const tickets =
    booking.status === "CONFIRMED" ? await listTicketsForBooking(booking.bookingId) : [];
  return NextResponse.json({
    bookingId: booking.bookingId,
    status: booking.status,
    eventTitle: event?.title ?? booking.eventId,
    startsAt: event?.startsAt ?? null,
    venue: event ? `${event.venue}, ${event.city}` : null,
    seats: booking.seatIds,
    amount: booking.amount,
    attendeeName: booking.attendeeName,
    tickets: tickets.map((t) => ({ ticketId: t.ticketId, seatId: t.seatId, name: t.attendeeName })),
  });
}
