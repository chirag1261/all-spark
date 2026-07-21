import { NextRequest, NextResponse } from "next/server";

import { getBookedSeats, getEvent, getLockedSeats } from "@/lib/db";
import { blockedSeatIds } from "@/lib/domain/events";

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
  return NextResponse.json({
    // Blocked seats (layout-level + ad-hoc holds) present as sold to the public.
    booked: [...new Set([...booked, ...blockedSeatIds(event)])],
    locked,
  });
}
