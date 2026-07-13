import nodemailer from "nodemailer";
import { Booking } from "./types";
import { MOVIES, THEATRES, getShowById, todayISO } from "./data";
import { ticketQrDataUrl } from "./ticket";

export function emailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

/**
 * Emails the ticket (with an inline QR code) to the booking's email address.
 * Never throws — a failed email must not fail a paid booking; the caller
 * gets {sent:false} and surfaces "ticket available on screen" instead.
 */
export async function sendTicketEmail(
  booking: Booking,
  ticketId: string
): Promise<{ sent: boolean; error?: string }> {
  if (!emailConfigured()) {
    return { sent: false, error: "SMTP not configured" };
  }

  const show = getShowById(booking.showId, todayISO());
  const movie = MOVIES.find((m) => m.id === show?.movieId);
  const theatre = THEATRES.find((t) => t.id === show?.theatreId);

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: Number(process.env.SMTP_PORT ?? 587) === 465,
      auth: { user: process.env.SMTP_USER!, pass: process.env.SMTP_PASS! },
    });

    // Inline the QR as a cid attachment — Gmail strips data: URLs in <img src>.
    const qrDataUrl = await ticketQrDataUrl(booking, ticketId);
    const qrBase64 = qrDataUrl.split(",")[1];

    const amountInr = `₹${(booking.amount / 100).toLocaleString("en-IN")}`;
    const seats = booking.seatIds.join(", ");

    await transporter.sendMail({
      from: process.env.EMAIL_FROM ?? `"BookMyShow Clone" <${process.env.SMTP_USER}>`,
      to: booking.customerEmail,
      subject: `🎟️ Your ticket ${ticketId} — ${movie?.title ?? "Movie"}`,
      text: [
        `Booking confirmed!`,
        ``,
        `Ticket ID: ${ticketId}`,
        `Booking ID: ${booking.bookingId}`,
        `Movie: ${movie?.title ?? booking.showId}`,
        `Theatre: ${theatre?.name ?? ""}`,
        `Show: Today ${show?.time ?? ""}`,
        `Seats: ${seats}`,
        `Amount paid: ${amountInr}`,
        ``,
        `Show the attached QR code at the theatre gate.`,
      ].join("\n"),
      html: `
        <div style="max-width:480px;margin:0 auto;font-family:Arial,Helvetica,sans-serif;background:#18181b;color:#fafafa;border-radius:16px;overflow:hidden">
          <div style="background:#f84464;padding:20px 24px">
            <h1 style="margin:0;font-size:20px;color:#fff">Booking confirmed 🎬</h1>
          </div>
          <div style="padding:24px">
            <p style="margin:0 0 16px;font-size:15px">Hi, your ticket for <strong>${movie?.title ?? "your movie"}</strong> is ready.</p>
            <div style="text-align:center;margin:20px 0">
              <img src="cid:ticket-qr" alt="Ticket QR code" width="200" height="200" style="border-radius:8px;background:#fff;padding:8px"/>
              <p style="font-family:monospace;font-size:18px;letter-spacing:1px;margin:12px 0 0">${ticketId}</p>
            </div>
            <table style="width:100%;font-size:14px;border-collapse:collapse">
              <tr><td style="padding:6px 0;color:#a1a1aa">Booking ID</td><td style="text-align:right;font-family:monospace">${booking.bookingId}</td></tr>
              <tr><td style="padding:6px 0;color:#a1a1aa">Theatre</td><td style="text-align:right">${theatre?.name ?? ""}</td></tr>
              <tr><td style="padding:6px 0;color:#a1a1aa">Show</td><td style="text-align:right">Today, ${show?.time ?? ""}</td></tr>
              <tr><td style="padding:6px 0;color:#a1a1aa">Seats</td><td style="text-align:right"><strong>${seats}</strong></td></tr>
              <tr><td style="padding:10px 0;color:#a1a1aa;border-top:1px solid #3f3f46">Amount paid</td><td style="text-align:right;border-top:1px solid #3f3f46;font-size:16px"><strong>${amountInr}</strong></td></tr>
            </table>
            <p style="font-size:12px;color:#a1a1aa;margin:20px 0 0">Show this QR code at the theatre gate. This is a demo app — no real ticket was purchased.</p>
          </div>
        </div>`,
      attachments: [
        {
          filename: `${ticketId}.png`,
          content: qrBase64,
          encoding: "base64",
          cid: "ticket-qr",
        },
      ],
    });
    return { sent: true };
  } catch (err) {
    console.error("Ticket email failed:", err);
    return { sent: false, error: err instanceof Error ? err.message : "send failed" };
  }
}
