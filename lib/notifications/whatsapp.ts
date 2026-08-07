import { getEvent } from "@/lib/db";
import { Booking, TicketRecord } from "@/types";

/**
 * WhatsApp ticket delivery via Meta's WhatsApp Cloud API directly (Graph
 * API), not a third-party wrapper. Mirrors lib/notifications/email.ts's
 * shape: a configured() gate, a dev-mode console fallback, never throws —
 * a failed WhatsApp send must never fail a paid booking.
 *
 * The approved "utsav_qr" template's own static copy (guidelines, entry
 * rules, etc.) already eats ~978 of Meta's 1024-character-per-message cap —
 * confirmed live: a body carrying the same richness as the ticket email
 * (venue, date, amount, booking id, a full ticket URL) reliably triggers
 * Meta error #132005 "Translated text too long", so every send silently
 * failed (email still went out, since a WhatsApp failure must never fail a
 * paid booking — the failure just never surfaced). There is only ~46
 * characters of headroom left, combined, across all 4 body variables — not
 * enough for a full ticket URL (51+ characters alone) no matter how the
 * rest is trimmed, so each field is hard-clipped via `clip()` and slot 4
 * (the template's "View / share this ticket" line) carries a short
 * reference rather than a link. If the template is ever re-approved with
 * shorter static copy, these caps can be relaxed.
 *
 * Body variable order matches the approved template's own field labels —
 * confirmed by inspecting a real delivered message: {{1}} Attendee,
 * {{2}} Seat, {{3}} Ticket ID, {{4}} the "View / share this ticket" line.
 */
const clip = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

export function whatsappConfigured(): boolean {
  return Boolean(process.env.META_WHATSAPP_PHONE_ID && process.env.META_WHATSAPP_ACCESS_TOKEN);
}

const TEMPLATE_NAME = () => process.env.META_WHATSAPP_TEMPLATE_NAME || "utsav_qr";
const GRAPH_VERSION = "v19.0";

async function sendTemplate(params: {
  to: string;
  imageUrl: string;
  bodyParams: string[];
}): Promise<{ sent: boolean; error?: string }> {
  const phoneId = process.env.META_WHATSAPP_PHONE_ID;
  const accessToken = process.env.META_WHATSAPP_ACCESS_TOKEN;
  if (!phoneId || !accessToken) return { sent: false, error: "WhatsApp is not configured" };

  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${phoneId}/messages`;
  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: params.to,
    type: "template",
    template: {
      name: TEMPLATE_NAME(),
      language: { code: "en" },
      components: [
        {
          type: "header",
          parameters: [{ type: "image", image: { link: params.imageUrl } }],
        },
        {
          type: "body",
          parameters: params.bodyParams.map((text) => ({ type: "text", text })),
        },
      ],
    },
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("WhatsApp send failed:", res.status, detail);
      return { sent: false, error: `WhatsApp API ${res.status}` };
    }
    return { sent: true };
  } catch (err) {
    console.error("WhatsApp send failed:", err);
    return { sent: false };
  }
}

/**
 * Sends every ticket in a confirmed booking to the purchaser's WhatsApp
 * number — one templated message per ticket (one QR each), same "one per
 * attendee" shape as the ticket email. The QR header image is the actual
 * functional ticket; the body text just fills the template's Attendee/
 * Seat/Ticket ID/share-line fields well enough to tell messages apart in a
 * multi-seat booking. `origin` is the site's own public base URL, used to
 * build the QR image link Meta's servers fetch.
 */
export async function sendTicketWhatsApp(
  booking: Booking,
  tickets: TicketRecord[],
  origin: string
): Promise<{ sent: boolean; error?: string }> {
  if (!booking.customerPhone) {
    return { sent: false, error: "No phone number on the account" };
  }

  const event = await getEvent(booking.eventId);
  const eventTitle = event?.title ?? "your event";

  if (!whatsappConfigured()) {
    console.log(
      `[whatsapp:dev] Would send ${tickets.length} ticket(s) for "${eventTitle}" to ${booking.customerPhone}`
    );
    return { sent: true }; // dev delivery — the server console is the inbox
  }

  let allSent = true;
  let lastError: string | undefined;
  for (const ticket of tickets) {
    const imageUrl = `${origin}/api/tickets/${encodeURIComponent(ticket.ticketId)}/qr.png`;
    const ticketRef = ticket.ticketId.split("-").pop() ?? ticket.ticketId;
    const result = await sendTemplate({
      to: booking.customerPhone,
      imageUrl,
      bodyParams: [
        clip(ticket.attendeeName, 16),
        clip(ticket.seatId, 10),
        clip(ticketRef, 8),
        clip(ticketRef, 8),
      ],
    });
    if (!result.sent) {
      allSent = false;
      lastError = result.error;
    }
  }
  return allSent ? { sent: true } : { sent: false, error: lastError };
}
