import QRCode from "qrcode";

import { NextRequest, NextResponse } from "next/server";

import { getBookingByBookingId, getTicket } from "@/lib/db";
import { ticketQrPayload } from "@/lib/domain/tickets";

/**
 * GET /api/tickets/[ticketId]/qr.png — the ticket's QR code as a plain PNG.
 *
 * Public and unauthenticated, same trust model as the already-public
 * /ticket/[ticketId] page: the ticket id itself (crypto-random, unguessable)
 * is the credential, not a session. Exists so Meta's WhatsApp servers can
 * fetch it directly as a template's dynamic image header via a plain URL —
 * they can't send our session cookies, so this can't be behind auth.
 */
export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/api/tickets/[ticketId]/qr.png">
) {
  const { ticketId } = await ctx.params;

  const ticket = await getTicket(decodeURIComponent(ticketId));
  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }
  const booking = await getBookingByBookingId(ticket.bookingId);
  if (!booking) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  const png = await QRCode.toBuffer(ticketQrPayload(ticket, booking), {
    width: 512,
    margin: 2,
    errorCorrectionLevel: "M",
    type: "png",
  });

  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
