import { NextRequest, NextResponse } from "next/server";

import { getBookedSeats, getEvent, getLockedSeats } from "@/lib/db";

/** GET /api/seats?eventId=... — current seat availability for an event. */
export async function GET(req: NextRequest) {
  const eventId = req.nextUrl.searchParams.get("eventId");
  if (!eventId) {
    return NextResponse.json({ error: "eventId is required" }, { status: 400 });
  }
  const event = await getEvent(eventId);
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }
  const [booked, locked] = await Promise.all([getBookedSeats(eventId), getLockedSeats(eventId)]);
  // Confirmed-sold seats ONLY — blocked seats are already rendered as
  // unavailable independently via each seat's own `blocked` flag (see
  // SeatMap), so folding them in here too would double them up wherever a
  // caller subtracts this count from totalSeats() (which already excludes
  // blocked seats).
  return NextResponse.json({ booked, locked });
}
