import { NextRequest, NextResponse } from "next/server";

import { getCurrentAdmin, hasPermission } from "@/lib/auth/admin";
import { listTicketsForBooking } from "@/lib/db";

/** GET /api/admin/tickets?bookingId=... — every ticket issued for a booking. */
export async function GET(req: NextRequest) {
  const user = await getCurrentAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(user, "bookings")) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  const bookingId = req.nextUrl.searchParams.get("bookingId");
  if (!bookingId) {
    return NextResponse.json({ error: "bookingId is required" }, { status: 400 });
  }

  const tickets = await listTicketsForBooking(bookingId);
  return NextResponse.json({
    tickets: tickets.map((t) => ({
      ticketId: t.ticketId,
      seatId: t.seatId,
      attendeeName: t.attendeeName,
    })),
  });
}
