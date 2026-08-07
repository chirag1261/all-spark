import { NextRequest, NextResponse } from "next/server";

import { getEvent, lockSeats } from "@/lib/db";
import { isValidSeatId } from "@/lib/domain/events";
import { clientKey, rateLimit } from "@/lib/http/ratelimit";

/**
 * POST /api/seats/hold — Body: { eventId, seatIds, holdId }
 *
 * Anonymous, pre-auth seat reservation: lets a visitor hold the seats they've
 * selected for the same TTL as a real order (see lockSeats/SEAT_LOCK_TTL_MS)
 * while they complete the checkout-time sign-in/sign-up step, so the seats
 * they picked aren't scooped by someone else mid-auth. /api/orders reuses
 * this SAME holdId as its provisional lock id once the customer is known, so
 * the hold carries straight through into the real order with no gap.
 */
export async function POST(req: NextRequest) {
  if (!rateLimit(`seat-hold:${clientKey(req)}`, 20, 60_000)) {
    return NextResponse.json(
      { error: "Too many requests — please wait a moment" },
      { status: 429 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const eventId = typeof body.eventId === "string" ? body.eventId : "";
  const holdId = typeof body.holdId === "string" ? body.holdId.trim() : "";
  const seatIds = Array.isArray(body.seatIds)
    ? body.seatIds
        .filter((s): s is string => typeof s === "string")
        .map((s) => s.toUpperCase().trim())
    : [];

  if (!eventId || !holdId || seatIds.length === 0) {
    return NextResponse.json(
      { error: "eventId, holdId and seatIds are required" },
      { status: 400 }
    );
  }

  const event = await getEvent(eventId);
  if (!event || !event.published) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const invalid = seatIds.find((id) => !isValidSeatId(event, id));
  if (invalid) {
    return NextResponse.json({ error: `Invalid seat: ${invalid}` }, { status: 400 });
  }

  const lock = await lockSeats(eventId, seatIds, holdId);
  if (!lock.ok) {
    return NextResponse.json(
      { error: "Some seats were just taken", conflicts: lock.conflicts },
      { status: 409 }
    );
  }
  return NextResponse.json({ ok: true });
}
