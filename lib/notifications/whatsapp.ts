import { getEvent } from "@/lib/db";
import { Booking, TicketRecord } from "@/types";
import { formatDateIST, inr } from "@/utils";

/**
 * WhatsApp ticket delivery via Meta's WhatsApp Cloud API directly (Graph
 * API), not a third-party wrapper. Mirrors lib/notifications/email.ts's
 * shape: a configured() gate, a dev-mode console fallback, never throws —
 * a failed WhatsApp send must never fail a paid booking.
 *
 * Carries the SAME details as the ticket email (booking id, event, venue,
 * date, amount paid, seat, ticket id, a link to view/share the ticket) —
 * packed into 4 body variables since an approved WhatsApp template has a
 * FIXED variable count/shape (Meta rejects anything that doesn't match
 * exactly), but doesn't care what text a variable actually contains. If the
 * real approved template has a different variable COUNT than 4, adjust the
 * `components` array below and re-split the fields accordingly — Meta's API
 * error message names exactly which part disagreed.
 */

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
 * attendee" shape as the ticket email, carrying the same facts (booking id,
 * event, venue, date, amount paid, seat, ticket id, ticket link). `origin`
 * is the site's own public base URL, used to build the QR image link Meta's
 * servers fetch and the ticket link included in the body text.
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
  const eventWhen = event ? formatDateIST(event.startsAt) : "";
  const venue = event ? `${event.venue}, ${event.city}` : "";
  const amountPaid = inr(booking.amount);

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
    const ticketUrl = `${origin}/ticket/${encodeURIComponent(ticket.ticketId)}`;
    const result = await sendTemplate({
      to: booking.customerPhone,
      imageUrl,
      bodyParams: [
        ticket.attendeeName,
        [eventTitle, venue, eventWhen].filter(Boolean).join(" · "),
        `Seat ${ticket.seatId} · ${amountPaid} paid · Booking ${booking.bookingId}`,
        `Ticket ${ticket.ticketId} · ${ticketUrl}`,
      ],
    });
    if (!result.sent) {
      allSent = false;
      lastError = result.error;
    }
  }
  return allSent ? { sent: true } : { sent: false, error: lastError };
}
