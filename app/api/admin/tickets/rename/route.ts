import { NextRequest, NextResponse } from "next/server";

import { getCurrentAdmin } from "@/lib/auth/admin";
import { audit, getTicket, renameTicketAttendee } from "@/lib/db";
import { logger } from "@/lib/logger";

/**
 * POST /api/admin/tickets/rename — Body: { ticketId, name }
 *
 * Transfers ownership of an already-issued ticket to a new attendee name,
 * instead of requiring a cancellation + rebooking. The ticket id and QR
 * signature are untouched — the same physical QR (already emailed/shared)
 * keeps working; only the name it's checked in under changes.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "super_admin") {
    return NextResponse.json(
      { error: "Only super admins can transfer ticket ownership" },
      { status: 403 }
    );
  }

  let body: { ticketId?: unknown; name?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const ticketId = typeof body.ticketId === "string" ? body.ticketId.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!ticketId) {
    return NextResponse.json({ error: "ticketId is required" }, { status: 400 });
  }
  if (name.length < 2 || name.length > 80) {
    return NextResponse.json({ error: "Name must be 2–80 characters" }, { status: 400 });
  }

  const existing = await getTicket(ticketId);
  if (!existing) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }
  if (name === existing.attendeeName) {
    return NextResponse.json({ error: "That's already the name on this ticket" }, { status: 400 });
  }

  const previousName = existing.attendeeName;
  const updated = await renameTicketAttendee(ticketId, name);
  if (!updated) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  await audit(
    "ticket.rename",
    "ticket",
    ticketId,
    `Renamed attendee on ticket ${ticketId} (seat ${existing.seatId}) from "${previousName}" to "${name}" — same booking/QR retained`
  );
  logger.be.info("Ticket ownership transferred", {
    ticketId,
    from: previousName,
    to: name,
    by: user.id,
  });

  return NextResponse.json({ ok: true, ticket: updated });
}
