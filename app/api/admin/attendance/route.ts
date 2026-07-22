import { NextRequest, NextResponse } from "next/server";

import { canScan, getCurrentAdmin } from "@/lib/auth/admin";
import { getAttendanceCounts, listTicketsForEvent } from "@/lib/db";

/**
 * GET /api/admin/attendance?eventId=… — live entry stats for one event.
 * Poll target for the scanner + attendance dashboards (~5s). Any admin who
 * can scan may read it. Returns sold-vs-checked-in counts plus the attendee
 * list with per-ticket entry status.
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canScan(user)) return NextResponse.json({ error: "Not allowed" }, { status: 403 });

  const eventId = req.nextUrl.searchParams.get("eventId")?.trim();
  if (!eventId) return NextResponse.json({ error: "eventId is required" }, { status: 400 });

  const [counts, tickets] = await Promise.all([
    getAttendanceCounts(eventId),
    listTicketsForEvent(eventId),
  ]);

  const attendees = tickets.map((t) => ({
    ticketId: t.ticketId,
    name: t.attendeeName,
    seat: t.seatId,
    status: t.scannedAt ? "IN" : "PENDING",
    scannedAt: t.scannedAt ?? null,
    scannedByName: t.scannedByName ?? null,
  }));

  return NextResponse.json({ counts, attendees });
}
