import Link from "next/link";
import { notFound } from "next/navigation";

import SiteHeader from "@/components/SiteHeader";
import WhatsAppShare from "@/components/WhatsAppShare";
import { EVENT_GUIDELINES } from "@/constants";
import { getBookingByBookingId, getEvent, getTicket } from "@/lib/db";
import { ticketQrDataUrl } from "@/lib/domain/tickets";
import { formatDateIST } from "@/utils";

/**
 * Public, WhatsApp-shareable ticket page — ONE attendee's QR per page.
 * The ticket id is an unguessable crypto-random code, so knowing the URL
 * is the access credential.
 */
export async function TicketScreen({ ticketId }: { ticketId: string }) {
  const ticket = await getTicket(decodeURIComponent(ticketId));
  if (!ticket) notFound();

  const booking = await getBookingByBookingId(ticket.bookingId);
  if (!booking || booking.status !== "CONFIRMED") notFound();

  const event = await getEvent(ticket.eventId);
  const qrDataUrl = await ticketQrDataUrl(ticket, booking);

  return (
    <div className="min-h-screen text-slate-900">
      <SiteHeader />
      <main className="max-w-md mx-auto px-4 py-10">
        <div className="relative bg-white border border-[#e5eaf1] rounded-3xl overflow-hidden shadow-[0_16px_40px_rgba(15,23,42,0.10)]">
          <div className="bg-linear-to-r from-[#1d4ed8] to-[#3b82f6] px-6 py-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/70 mb-1">
              Event ticket
            </p>
            <h1 className="font-extrabold text-xl text-white tracking-tight wrap-break-word">
              {event?.title ?? "Event ticket"}
            </h1>
            {event && (
              <p className="text-sm text-white/80 mt-0.5">
                {formatDateIST(event.startsAt)} · {event.venue}, {event.city}
              </p>
            )}
          </div>

          <div className="p-6 pb-2">
            <div className="flex flex-col items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrDataUrl}
                alt={`Ticket QR ${ticket.ticketId}`}
                className="w-48 h-48 rounded-2xl bg-white p-2 shadow-[0_0_40px_rgba(29,78,216,0.15)]"
              />
              <p className="font-mono text-lg tracking-[0.2em] mt-1">{ticket.ticketId}</p>
              <p className="text-xs text-slate-500">Show this QR at the venue gate</p>
            </div>
          </div>

          {/* Perforation between the QR stub and the details */}
          <div className="relative flex items-center px-6 py-4" aria-hidden="true">
            <span className="absolute -left-3 w-6 h-6 rounded-full bg-white border border-[#e5eaf1]" />
            <span className="flex-1 border-t-2 border-dashed border-[#cbd5e1]" />
            <span className="absolute -right-3 w-6 h-6 rounded-full bg-white border border-[#e5eaf1]" />
          </div>

          <div className="px-6 pb-6 space-y-3">
            <Row label="Attendee" value={ticket.attendeeName} />
            <Row label="Seat" value={ticket.seatId} strong />
            <Row label="Booking ID" value={booking.bookingId} mono />
            {booking.seatIds.length > 1 && (
              <p className="text-xs text-slate-500 pt-1">
                This booking has {booking.seatIds.length} tickets — each attendee has their own QR.
              </p>
            )}
          </div>
        </div>

        <div className="mt-5">
          {/* Plain text + WhatsApp *bold* only — no emoji. Astral-plane emoji
              get mangled to "�" by some WhatsApp share transports, while
              WhatsApp's own bold markdown renders reliably. */}
          <WhatsAppShare
            imageUrl={event?.imageUrl || event?.gallery[0]}
            lines={[
              `*${event?.title ?? "Event ticket"}*`,
              event ? formatDateIST(event.startsAt) : "",
              event ? `${event.venue}, ${event.city}` : "",
              "",
              "*Booking details*",
              `Attendee: ${ticket.attendeeName}`,
              `Seat: ${ticket.seatId}`,
              `Ticket ID: ${ticket.ticketId}`,
              "",
              "*Event guidelines*",
              ...EVENT_GUIDELINES.map((g, i) => `${i + 1}. ${g}`),
              "",
              "View / share this ticket:",
            ].filter(Boolean)}
          />
        </div>

        <div className="mt-5 bg-white border border-[#e5eaf1] rounded-2xl p-5">
          <p className="text-sm font-semibold mb-2.5">Event guidelines</p>
          <ol className="list-decimal list-inside space-y-1.5 text-xs text-slate-600 leading-relaxed marker:text-[#1d4ed8]">
            {EVENT_GUIDELINES.map((g, i) => (
              <li key={i} className="wrap-break-word">
                {g}
              </li>
            ))}
          </ol>
        </div>

        <p className="text-center mt-8">
          <Link href="/" className="text-sm text-[#1d4ed8] hover:underline">
            Browse events →
          </Link>
        </p>
      </main>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
  strong,
}: {
  label: string;
  value: string;
  mono?: boolean;
  strong?: boolean;
}) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-slate-500">{label}</span>
      <span
        className={`${mono ? "font-mono" : ""} ${strong ? "font-bold text-base" : ""} text-right wrap-break-word min-w-0`}
      >
        {value}
      </span>
    </div>
  );
}
