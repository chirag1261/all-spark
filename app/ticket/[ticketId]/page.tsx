import type { Metadata } from "next";

import { getEvent, getTicket } from "@/lib/db";
import { TicketScreen } from "@/screens";
import { formatDateIST } from "@/utils";

export const dynamic = "force-dynamic";

/**
 * Rich link preview for shares (WhatsApp, etc.): when a ticket link is sent
 * as plain text (Web Share/file-attach unsupported, or the recipient just
 * pastes the link), WhatsApp unfurls these OG tags and shows the event's
 * banner + title + venue/date instead of a bare link.
 */
export async function generateMetadata({
  params,
}: PageProps<"/ticket/[ticketId]">): Promise<Metadata> {
  const { ticketId } = await params;
  const ticket = await getTicket(decodeURIComponent(ticketId));
  if (!ticket) return { title: "Ticket — Utsav Events" };

  const event = await getEvent(ticket.eventId);
  const where = event
    ? `${formatDateIST(event.startsAt)} · ${event.venue}, ${event.city}`
    : undefined;
  const banner = event?.imageUrl || event?.gallery[0] || undefined;
  const base = process.env.NEXT_PUBLIC_BASE_URL || "https://utsavevents.live";

  return {
    metadataBase: new URL(base),
    title: `${ticket.attendeeName}'s ticket — ${event?.title ?? "Utsav Events"}`,
    description: where ?? `Seat ${ticket.seatId}`,
    openGraph: {
      title: event?.title ?? "Event ticket",
      description: where ?? `Seat ${ticket.seatId}`,
      type: "website",
      ...(banner ? { images: [{ url: banner, alt: event?.title ?? "Event banner" }] } : {}),
    },
    twitter: {
      card: banner ? "summary_large_image" : "summary",
      title: event?.title ?? "Event ticket",
      description: where ?? `Seat ${ticket.seatId}`,
      ...(banner ? { images: [banner] } : {}),
    },
  };
}

export default async function Page({ params }: PageProps<"/ticket/[ticketId]">) {
  const { ticketId } = await params;
  return <TicketScreen ticketId={ticketId} />;
}
