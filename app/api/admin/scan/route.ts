import { NextRequest, NextResponse } from "next/server";

import { canScan, getCurrentAdmin } from "@/lib/auth/admin";
import { checkInTicket, getBookingByBookingId, getEvent, getTicket } from "@/lib/db";
import { verifyTicketToken } from "@/lib/domain/tickets";
import { logger } from "@/lib/logger";

type ScanResult = "VALID" | "ALREADY_USED" | "WRONG_EVENT" | "NOT_CONFIRMED" | "NOT_FOUND" | "INVALID";

/**
 * POST /api/admin/scan — venue gate check-in.
 * Body: { ticketId, sig?, eventId }
 *
 * Verifies a scanned QR against the DB and, on success, atomically stamps the
 * ticket as checked in. The hard gate is the ticket lookup + CONFIRMED booking
 * + event match + not-already-scanned; the optional `sig` (HMAC) additionally
 * proves the QR was issued by us. Any authenticated admin (incl. gate staff)
 * may scan.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canScan(user)) return NextResponse.json({ error: "Not allowed" }, { status: 403 });

  let body: { ticketId?: unknown; sig?: unknown; eventId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const ticketId = typeof body.ticketId === "string" ? body.ticketId.trim() : "";
  const sig = typeof body.sig === "string" ? body.sig : "";
  const eventId = typeof body.eventId === "string" ? body.eventId.trim() : "";
  if (!ticketId || !eventId) {
    return NextResponse.json({ error: "ticketId and eventId are required" }, { status: 400 });
  }

  const respond = (result: ScanResult, extra: Record<string, unknown> = {}) =>
    NextResponse.json({ result, ...extra });

  // A present-but-wrong signature means a hand-crafted/forged QR — reject early.
  if (sig && !verifyTicketToken(ticketId, sig)) {
    logger.be.warn("Scan rejected: bad ticket signature", { ticketId, eventId, by: user.id });
    return respond("INVALID");
  }

  const ticket = await getTicket(ticketId);
  if (!ticket) {
    logger.be.warn("Scan rejected: ticket not found", { ticketId, eventId, by: user.id });
    return respond("NOT_FOUND");
  }

  if (ticket.eventId !== eventId) {
    const event = await getEvent(ticket.eventId);
    return respond("WRONG_EVENT", { ticketEvent: event?.title ?? ticket.eventId });
  }

  const booking = await getBookingByBookingId(ticket.bookingId);
  if (!booking || booking.status !== "CONFIRMED") {
    return respond("NOT_CONFIRMED");
  }

  const checkedIn = await checkInTicket(ticketId, user.id, user.name);
  if (!checkedIn) {
    // 0 rows updated → it was already scanned (or raced). Report who/when.
    const prior = await getTicket(ticketId);
    logger.be.warn("Scan rejected: ticket already used", {
      ticketId,
      eventId,
      by: user.id,
      firstScanBy: prior?.scannedByName,
    });
    return respond("ALREADY_USED", {
      name: prior?.attendeeName,
      seat: prior?.seatId,
      scannedAt: prior?.scannedAt,
      scannedByName: prior?.scannedByName,
    });
  }

  logger.be.info("Ticket checked in", { ticketId, eventId, by: user.id });
  return respond("VALID", {
    name: checkedIn.attendeeName,
    seat: checkedIn.seatId,
    scannedAt: checkedIn.scannedAt,
  });
}
