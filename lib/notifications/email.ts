import { Resend } from "resend";

import { EVENT_GUIDELINES, TICKET_NOTICES } from "@/constants";
import { getEvent } from "@/lib/db";
import { ticketQrDataUrl } from "@/lib/domain/tickets";
import { Booking, TicketRecord } from "@/types";
import { inr } from "@/utils";

/**
 * Resend (https://resend.com) instead of raw SMTP: it authenticates with an
 * API key over HTTPS, so there's no IP/location-based login risk-flagging the
 * way Gmail SMTP does when called from a serverless platform's rotating
 * outbound IPs (Vercel, etc.) — see the 534 "WebLoginRequired" failures that
 * motivated this switch.
 */
export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

function client(): Resend {
  return new Resend(process.env.RESEND_API_KEY);
}

// Falls back to Resend's own onboarding sender until a domain is verified —
// see https://resend.com/domains. Set EMAIL_FROM once utsavevents.tech (or
// whatever domain) is verified, so mail comes from your own address.
const FROM = () => process.env.EMAIL_FROM ?? "Utsav Events <onboarding@resend.dev>";

const eventDate = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  });

/**
 * Delivers a login/signup OTP. Without SMTP, logs to the SERVER console only
 * (never returned to the browser) so the flow stays testable in dev.
 */
export async function sendOtpEmail(to: string, code: string): Promise<{ sent: boolean }> {
  if (!emailConfigured()) {
    console.log(`[email:dev] OTP for ${to}: ${code}`);
    return { sent: true }; // dev delivery — the server console is the inbox
  }
  try {
    const { error } = await client().emails.send({
      from: FROM(),
      to,
      subject: `${code} is your Utsav Events verification code`,
      text: `Your verification code is ${code}. It is valid for 5 minutes.\n\nIf you didn't request this, you can ignore this email.`,
      html: `
        <div style="background:#f5f8ff;padding:24px 0">
          <div style="max-width:420px;margin:0 auto;font-family:Arial,Helvetica,sans-serif;background:#ffffff;color:#0f172a;border:1px solid #e5eaf1;border-radius:16px;overflow:hidden">
            <div style="background:#1d4ed8;padding:16px 24px">
              <h1 style="margin:0;font-size:18px;color:#ffffff">Verification code</h1>
            </div>
            <div style="padding:24px;text-align:center">
              <p style="margin:0 0 12px;font-size:14px;color:#64748b">Use this code to continue signing in:</p>
              <p style="font-family:monospace;font-size:32px;letter-spacing:8px;margin:0;color:#1d4ed8"><strong>${code}</strong></p>
              <p style="font-size:12px;color:#64748b;margin:16px 0 0">Valid for 5 minutes. If you didn't request this, ignore this email.</p>
            </div>
          </div>
        </div>`,
    });
    if (error) {
      console.error("OTP email failed:", error);
      return { sent: false };
    }
    return { sent: true };
  } catch (err) {
    console.error("OTP email failed:", err);
    return { sent: false };
  }
}

/** Where public contact-form messages are delivered. */
const CONTACT_TO = () => process.env.ADMIN_EMAIL || "utsavevents.tech@gmail.com";

/**
 * Relays a public "contact us" message to the team inbox. Never throws — the
 * form should always confirm receipt to the user; delivery failures are logged
 * server-side only. Returns whether it was actually sent.
 */
export async function sendContactMessage(msg: {
  name: string;
  email: string;
  phone?: string;
  topic?: string;
  message: string;
}): Promise<{ sent: boolean }> {
  const lines = [
    `Name: ${msg.name}`,
    `Email: ${msg.email}`,
    ...(msg.phone ? [`Phone: ${msg.phone}`] : []),
    ...(msg.topic ? [`Topic: ${msg.topic}`] : []),
    "",
    msg.message,
  ].join("\n");

  if (!emailConfigured()) {
    console.log(`[email:dev] Contact message:\n${lines}`);
    return { sent: true }; // dev delivery — the server console is the inbox
  }
  try {
    const { error } = await client().emails.send({
      from: FROM(),
      to: CONTACT_TO(),
      replyTo: msg.email,
      subject: `Contact form: ${msg.topic || "General enquiry"} — ${msg.name}`,
      text: lines,
    });
    if (error) {
      console.error("Contact email failed:", error);
      return { sent: false };
    }
    return { sent: true };
  } catch (err) {
    console.error("Contact email failed:", err);
    return { sent: false };
  }
}

/** Where server warn/error log alerts are delivered (falls back to ADMIN_EMAIL). */
const LOG_ALERT_TO = () => process.env.LOG_ALERT_EMAIL || process.env.ADMIN_EMAIL;

/**
 * Fire-and-forget alert email for a warn/error log line (see lib/logger.ts).
 * Never throws, and silently no-ops without RESEND_API_KEY or a recipient —
 * a failed/missing alert must never break the code path that triggered it.
 */
export async function sendLogAlertEmail(subject: string, text: string): Promise<{ sent: boolean }> {
  const to = LOG_ALERT_TO();
  if (!to || !emailConfigured()) return { sent: false };
  try {
    const { error } = await client().emails.send({ from: FROM(), to, subject, text });
    if (error) {
      console.error("Log alert email failed:", error);
      return { sent: false };
    }
    return { sent: true };
  } catch (err) {
    console.error("Log alert email failed:", err);
    return { sent: false };
  }
}

/**
 * Emails ALL of a booking's tickets — one QR per attendee/seat, each with its
 * own shareable link. Never throws — a failed email must not fail a paid
 * booking; the caller gets {sent:false} and surfaces "tickets on screen".
 */
export async function sendTicketEmail(
  booking: Booking,
  tickets: TicketRecord[],
  origin: string
): Promise<{ sent: boolean; error?: string }> {
  if (!emailConfigured()) {
    return { sent: false, error: "Resend is not configured (RESEND_API_KEY missing)" };
  }
  if (!booking.customerEmail) {
    return { sent: false, error: "No email on the account" };
  }

  const event = await getEvent(booking.eventId);

  try {
    const attachments = [];
    const ticketBlocksHtml: string[] = [];
    const ticketBlocksText: string[] = [];

    for (let i = 0; i < tickets.length; i++) {
      const t = tickets[i];
      const qrDataUrl = await ticketQrDataUrl(t, booking);
      // Inline the QR via a Content-ID (cid:) attachment, NOT a data: URI —
      // Gmail and most clients strip inline `data:` images from email bodies
      // (which rendered the QR as an empty/dark square). A cid attachment
      // renders inline reliably and isn't duplicated in the attachment list.
      const cid = `qr-${t.ticketId}`;
      attachments.push({
        filename: `${t.ticketId}.png`,
        content: Buffer.from(qrDataUrl.split(",")[1], "base64"),
        contentId: cid,
      });
      const ticketUrl = `${origin}/ticket/${encodeURIComponent(t.ticketId)}`;
      ticketBlocksHtml.push(`
        <div style="border:1px solid #e5eaf1;border-radius:12px;padding:16px;margin:12px 0;text-align:center;background:#ffffff">
          <p style="margin:0 0 8px;font-weight:bold;color:#0f172a">${t.attendeeName} · Seat ${t.seatId}</p>
          <img src="cid:${cid}" alt="Ticket QR ${t.ticketId}" width="180" height="180" style="border-radius:8px;background:#ffffff;padding:6px;display:block;margin:0 auto"/>
          <p style="font-family:monospace;font-size:15px;letter-spacing:1px;margin:10px 0 4px;color:#0f172a">${t.ticketId}</p>
          <a href="${ticketUrl}" style="font-size:13px;color:#1d4ed8;font-weight:600">View / share this ticket</a>
        </div>`);
      ticketBlocksText.push(
        `- ${t.attendeeName} · Seat ${t.seatId} · ${t.ticketId} · ${ticketUrl}`
      );
    }

    const amountInr = inr(booking.amount);

    const { error } = await client().emails.send({
      from: FROM(),
      to: booking.customerEmail,
      subject: `🎫 Your ${tickets.length > 1 ? `${tickets.length} tickets` : "ticket"} — ${event?.title ?? "Event"}`,
      text: [
        `Booking confirmed!`,
        ``,
        `Booking ID: ${booking.bookingId}`,
        `Event: ${event?.title ?? booking.eventId}`,
        `Venue: ${event ? `${event.venue}, ${event.city}` : ""}`,
        `When: ${event ? eventDate(event.startsAt) : ""}`,
        `Amount paid: ${amountInr}`,
        ``,
        `Tickets (each person shows their own QR at the gate):`,
        ...ticketBlocksText,
        ``,
        ...TICKET_NOTICES,
        ``,
        `Event guidelines:`,
        ...EVENT_GUIDELINES.map((g, i) => `${i + 1}. ${g}`),
        ``,
        `Need to modify or cancel this booking? Email bookings@utsavevents.live with your booking ID.`,
      ].join("\n"),
      html: `
        <div style="background:#f5f8ff;padding:24px 0">
          <div style="max-width:480px;margin:0 auto;font-family:Arial,Helvetica,sans-serif;background:#ffffff;color:#0f172a;border:1px solid #e5eaf1;border-radius:16px;overflow:hidden">
            <div style="background:#1d4ed8;padding:20px 24px">
              <h1 style="margin:0;font-size:20px;color:#ffffff">Booking confirmed 🎉</h1>
            </div>
            <div style="padding:24px">
              <p style="margin:0 0 4px;font-size:15px;color:#0f172a">Hi ${booking.attendeeName}, your ${tickets.length > 1 ? `${tickets.length} tickets are` : "ticket is"} ready for <strong>${event?.title ?? "your event"}</strong>.</p>
              ${
                event
                  ? `<p style="margin:0 0 2px;font-size:13px;color:#64748b">${eventDate(event.startsAt)}</p>
              <p style="margin:0 0 16px;font-size:13px;color:#64748b">${event.venue}, ${event.city}</p>`
                  : ""
              }
              ${ticketBlocksHtml.join("")}
              <table style="width:100%;font-size:14px;border-collapse:collapse;margin-top:8px">
                <tr><td style="padding:6px 0;color:#64748b">Booking ID</td><td style="text-align:right;font-family:monospace;color:#0f172a">${booking.bookingId}</td></tr>
                <tr><td style="padding:10px 0;color:#64748b;border-top:1px solid #e5eaf1">Amount paid</td><td style="text-align:right;border-top:1px solid #e5eaf1;font-size:16px;color:#0f172a"><strong>${amountInr}</strong></td></tr>
              </table>
              <p style="font-size:12px;color:#64748b;margin:20px 0 0">Each attendee shows their own QR at the venue gate. Keep ticket IDs private — anyone with an ID can view that ticket.</p>
              <div style="margin-top:16px;padding:12px 14px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px">
                <ul style="margin:0;padding-left:16px;font-size:12px;font-weight:bold;color:#b91c1c;line-height:1.7">
                  ${TICKET_NOTICES.map((n) => `<li>${n}</li>`).join("")}
                </ul>
              </div>
              <div style="margin-top:20px;padding-top:16px;border-top:1px solid #e5eaf1">
                <p style="font-size:13px;font-weight:bold;color:#0f172a;margin:0 0 8px">Event guidelines</p>
                <ol style="margin:0;padding-left:18px;font-size:12px;color:#64748b;line-height:1.7">
                  ${EVENT_GUIDELINES.map((g) => `<li>${g}</li>`).join("")}
                </ol>
              </div>
              <p style="font-size:12px;color:#64748b;margin:16px 0 0">Need to modify or cancel this booking? Email <a href="mailto:bookings@utsavevents.live" style="color:#1d4ed8">bookings@utsavevents.live</a> with your booking ID.</p>
            </div>
          </div>
        </div>`,
      attachments,
    });
    if (error) {
      console.error("Ticket email failed:", error);
      return { sent: false, error: error.message };
    }
    return { sent: true };
  } catch (err) {
    console.error("Ticket email failed:", err);
    return { sent: false, error: err instanceof Error ? err.message : "send failed" };
  }
}
