import { Resend } from "resend";

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
        <div style="max-width:420px;margin:0 auto;font-family:Arial,Helvetica,sans-serif;background:#18181b;color:#fafafa;border-radius:16px;overflow:hidden">
          <div style="background:#f84464;padding:16px 24px">
            <h1 style="margin:0;font-size:18px;color:#fff">Verification code</h1>
          </div>
          <div style="padding:24px;text-align:center">
            <p style="margin:0 0 12px;font-size:14px;color:#a1a1aa">Use this code to continue signing in:</p>
            <p style="font-family:monospace;font-size:32px;letter-spacing:8px;margin:0">${code}</p>
            <p style="font-size:12px;color:#a1a1aa;margin:16px 0 0">Valid for 5 minutes. If you didn't request this, ignore this email.</p>
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
      // Also attached as a downloadable file, in addition to being shown inline below.
      attachments.push({
        filename: `${t.ticketId}.png`,
        content: Buffer.from(qrDataUrl.split(",")[1], "base64"),
      });
      const ticketUrl = `${origin}/ticket/${encodeURIComponent(t.ticketId)}`;
      ticketBlocksHtml.push(`
        <div style="border:1px solid #3f3f46;border-radius:12px;padding:16px;margin:12px 0;text-align:center">
          <p style="margin:0 0 4px;font-weight:bold">${t.attendeeName} · Seat ${t.seatId}</p>
          <img src="${qrDataUrl}" alt="Ticket QR ${t.ticketId}" width="160" height="160" style="border-radius:8px;background:#fff;padding:6px"/>
          <p style="font-family:monospace;font-size:15px;letter-spacing:1px;margin:8px 0 4px">${t.ticketId}</p>
          <a href="${ticketUrl}" style="font-size:13px;color:#f84464">View / share this ticket</a>
        </div>`);
      ticketBlocksText.push(
        `- ${t.attendeeName} · Seat ${t.seatId} · ${t.ticketId} · ${ticketUrl}`
      );
    }

    const amountInr = inr(booking.amount);

    const { error } = await client().emails.send({
      from: FROM(),
      to: booking.customerEmail,
      subject: `🎟️ Your ${tickets.length > 1 ? `${tickets.length} tickets` : "ticket"} — ${event?.title ?? "Event"}`,
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
      ].join("\n"),
      html: `
        <div style="max-width:480px;margin:0 auto;font-family:Arial,Helvetica,sans-serif;background:#18181b;color:#fafafa;border-radius:16px;overflow:hidden">
          <div style="background:#f84464;padding:20px 24px">
            <h1 style="margin:0;font-size:20px;color:#fff">Booking confirmed 🎉</h1>
          </div>
          <div style="padding:24px">
            <p style="margin:0 0 4px;font-size:15px">Hi ${booking.attendeeName}, your ${tickets.length > 1 ? `${tickets.length} tickets are` : "ticket is"} ready for <strong>${event?.title ?? "your event"}</strong>.</p>
            <p style="margin:0 0 16px;font-size:13px;color:#a1a1aa">${event ? `${eventDate(event.startsAt)} · ${event.venue}, ${event.city}` : ""}</p>
            ${ticketBlocksHtml.join("")}
            <table style="width:100%;font-size:14px;border-collapse:collapse;margin-top:8px">
              <tr><td style="padding:6px 0;color:#a1a1aa">Booking ID</td><td style="text-align:right;font-family:monospace">${booking.bookingId}</td></tr>
              <tr><td style="padding:10px 0;color:#a1a1aa;border-top:1px solid #3f3f46">Amount paid</td><td style="text-align:right;border-top:1px solid #3f3f46;font-size:16px"><strong>${amountInr}</strong></td></tr>
            </table>
            <p style="font-size:12px;color:#a1a1aa;margin:20px 0 0">Each attendee shows their own QR at the venue gate. Keep ticket IDs private — anyone with an ID can view that ticket.</p>
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
