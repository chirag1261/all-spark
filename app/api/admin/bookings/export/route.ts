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

  const header = [
    "Booking ID",
    "Ticket ID",
    "Status",
    "Event",
    "Attendee",
    "Email",
    "Phone",
    "Seats",
    "Amount (INR)",
    "Payment ID",
    "Booked At (IST)",
  ];
  const lines = [header.map(cell).join(",")];
  for (const b of rows) {
    lines.push(
      [
        cell(b.bookingId),
        cell(b.ticketId ?? ""),
        cell(b.status),
        cell(eventTitleById.get(b.eventId) ?? b.eventId),
        cell(b.attendeeName),
        cell(b.customerEmail),
        cell(b.customerPhone),
        cell(b.seatIds.join(" ")),
        cell((b.amount / 100).toFixed(2)),
        cell(b.razorpayPaymentId ?? ""),
        cell(new Date(b.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })),
      ].join(",")
    );
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
