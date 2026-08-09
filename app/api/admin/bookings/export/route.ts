import { NextRequest, NextResponse } from "next/server";

import { getCurrentAdmin, hasPermission } from "@/lib/auth/admin";
import { listBookings, listEvents } from "@/lib/db";

/**
 * GET /api/admin/bookings/export?eventId=&q=&status=
 * Streams the (filtered) booking list as a CSV download — opens in Excel/Sheets.
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(user, "bookings")) {
    return NextResponse.json({ error: "Missing bookings permission" }, { status: 403 });
  }

  const eventId = req.nextUrl.searchParams.get("eventId") ?? undefined;
  const query = req.nextUrl.searchParams.get("q") ?? undefined;
  const status = req.nextUrl.searchParams.get("status") ?? undefined;

  let rows = await listBookings({ eventId, query });
  if (status) rows = rows.filter((b) => b.status === status);
  const eventTitleById = new Map((await listEvents()).map((e) => [e.id, e.title]));

  // Excel-safe CSV: quote everything, double inner quotes, prefix =+-@ to block formula injection.
  const cell = (v: string | number) => {
    let s = String(v);
    if (/^[=+\-@]/.test(s)) s = `'${s}`;
    return `"${s.replaceAll('"', '""')}"`;
  };

  // One row per seat/attendee, not per booking — a multi-seat booking can
  // have a different name/phone/email/gender per attendee, none of which a
  // single purchaser-level row could show. Falls back to the purchaser's own
  // details for a seat with no attendee record (shouldn't happen post-
  // booking, but PENDING/FAILED rows may predate that seat being filled in).
  const header = [
    "Booking ID",
    "Status",
    "Event",
    "Seat",
    "Attendee Name",
    "Attendee Phone",
    "Attendee Email",
    "Attendee Gender",
    "Purchaser Email",
    "Purchaser Phone",
    "Booking Amount (INR)",
    "Payment ID",
    "Booked At (IST)",
  ];
  const lines = [header.map(cell).join(",")];
  for (const b of rows) {
    const attendeeBySeat = new Map(b.attendees.map((a) => [a.seatId, a]));
    const bookedAt = new Date(b.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
    b.seatIds.forEach((seatId, seatIndex) => {
      const attendee = attendeeBySeat.get(seatId);
      lines.push(
        [
          cell(b.bookingId),
          cell(b.status),
          cell(eventTitleById.get(b.eventId) ?? b.eventId),
          cell(seatId),
          cell(attendee?.name ?? b.attendeeName),
          cell(attendee?.phone ?? ""),
          cell(attendee?.email ?? ""),
          cell(attendee?.gender ?? ""),
          cell(b.customerEmail),
          cell(b.customerPhone),
          // Booking-level total, so it belongs to the BOOKING, not the seat.
          // Emit it once (first seat row) and leave it blank on the rest —
          // repeating it per seat made the column sum to several times the
          // real revenue for any multi-seat booking.
          cell(seatIndex === 0 ? (b.amount / 100).toFixed(2) : ""),
          cell(b.razorpayPaymentId ?? ""),
          cell(bookedAt),
        ].join(",")
      );
    });
  }

  return new NextResponse(lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="bookings-${new Date()
        .toISOString()
        .slice(0, 10)}.csv"`,
    },
  });
}
