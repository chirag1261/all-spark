import Link from "next/link";
import { notFound } from "next/navigation";

import SiteHeader from "@/components/SiteHeader";
import WhatsAppShare from "@/components/WhatsAppShare";
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
    <div className="min-h-screen text-zinc-100">
      <SiteHeader />
      <main className="max-w-md mx-auto px-4 py-10">
        <div className="relative bg-[#16181d] border border-[#24272e] rounded-3xl overflow-hidden shadow-[0_24px_60px_rgba(0,0,0,0.5)]">
          <div className="bg-linear-to-r from-[#f84464] to-[#ff2e63] px-6 py-5">
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
                className="w-48 h-48 rounded-2xl bg-white p-2 shadow-[0_0_40px_rgba(248,68,100,0.15)]"
              />
              <p className="font-mono text-lg tracking-[0.2em] mt-1">{ticket.ticketId}</p>
              <p className="text-xs text-zinc-500">Show this QR at the venue gate</p>
            </div>
          </div>

          {/* Perforation between the QR stub and the details */}
          <div className="relative flex items-center px-6 py-4" aria-hidden="true">
            <span className="absolute -left-3 w-6 h-6 rounded-full bg-[#0d0f12] border border-[#24272e]" />
            <span className="flex-1 border-t-2 border-dashed border-[#2b2f37]" />
            <span className="absolute -right-3 w-6 h-6 rounded-full bg-[#0d0f12] border border-[#24272e]" />
          </div>

          <div className="px-6 pb-6 space-y-3">
            <Row label="Attendee" value={ticket.attendeeName} />
            <Row label="Seat" value={ticket.seatId} strong />
            <Row label="Booking ID" value={booking.bookingId} mono />
            {booking.seatIds.length > 1 && (
              <p className="text-xs text-zinc-500 pt-1">
                This booking has {booking.seatIds.length} tickets — each attendee has their own QR.
              </p>
            )}
          </div>
        </div>

        <div className="mt-5">
          <WhatsAppShare
            lines={[
              `🎟️ *${event?.title ?? "Event ticket"}*`,
              event ? `${formatDateIST(event.startsAt)} · ${event.venue}, ${event.city}` : "",
              `Attendee: ${ticket.attendeeName}`,
              `Seat: ${ticket.seatId}`,
              `Ticket: ${ticket.ticketId}`,
            ].filter(Boolean)}
          />
        </div>

        <p className="text-center mt-8">
          <Link href="/" className="text-sm text-[#f84464] hover:underline">
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
      <span className="text-zinc-500">{label}</span>
      <span
        className={`${mono ? "font-mono" : ""} ${strong ? "font-bold text-base" : ""} text-right wrap-break-word min-w-0`}
      >
        {value}
      </span>
    </div>
  );
}
