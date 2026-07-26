import type { Metadata } from "next";

import { getEvent } from "@/lib/db";
import { EventDetailScreen } from "@/screens";
import { formatDateIST } from "@/utils";

export const dynamic = "force-dynamic";

/**
 * Rich link preview for shares (WhatsApp, etc.): WhatsApp fetches these
 * OpenGraph tags from the event URL and shows the banner image + title +
 * venue/date when the link is pasted into a chat.
 */
export async function generateMetadata({
  params,
}: PageProps<"/events/[id]">): Promise<Metadata> {
  const { id } = await params;
  const event = await getEvent(id);
  if (!event) return { title: "Event — Utsav Events" };

  const where = `${formatDateIST(event.startsAt)} · ${event.venue}${event.city ? `, ${event.city}` : ""}`;
  const banner = event.imageUrl || event.gallery[0] || undefined;
  const base = process.env.NEXT_PUBLIC_BASE_URL || "https://utsavevents.live";

  return {
    metadataBase: new URL(base),
    title: `${event.title} — Utsav Events`,
    description: event.tagline || where,
    openGraph: {
      title: event.title,
      description: event.tagline ? `${event.tagline} · ${where}` : where,
      type: "website",
      ...(banner ? { images: [{ url: banner, alt: event.title }] } : {}),
    },
    twitter: {
      card: banner ? "summary_large_image" : "summary",
      title: event.title,
      description: where,
      ...(banner ? { images: [banner] } : {}),
    },
  };
}

export default async function Page({ params }: PageProps<"/events/[id]">) {
  const { id } = await params;
  return <EventDetailScreen id={id} />;
}
