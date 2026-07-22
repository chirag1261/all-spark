"use client";

import { useEffect, useState } from "react";

import { CalendarDays, MapPin, Sparkles } from "lucide-react";
import Link from "next/link";

import { formatDateIST } from "@/utils";

export interface CarouselEvent {
  id: string;
  title: string;
  imageUrl: string;
  poster: string;
  startsAt: string;
  venue: string;
  city: string;
}

interface Props {
  events: CarouselEvent[];
  /** Shorter card for the stacked mobile layout; taller for the desktop brand panel. */
  compact?: boolean;
}

const INTERVAL_MS = 6000;

/**
 * "Active events" teaser for the login screens — one card at a time,
 * auto-advancing with the same glassy dot controls as HeroMedia. Renders a
 * graceful empty state itself so callers never need to special-case it.
 */
export default function EventsCarousel({ events, compact = false }: Props) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (events.length < 2) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % events.length), INTERVAL_MS);
    return () => clearInterval(timer);
  }, [events.length]);

  const aspect = compact ? "aspect-video" : "aspect-4/5";

  if (events.length === 0) {
    return (
      <div
        className={`w-full ${aspect} rounded-2xl border border-[#2a2450] bg-[#171228] flex flex-col items-center justify-center gap-3 p-8 text-center`}
      >
        <Sparkles className="w-8 h-8 text-[#d99a45]" aria-hidden="true" />
        <p className="font-heading text-lg font-semibold">No live events right now</p>
        <p className="text-sm text-zinc-500">Check back soon — new shows are announced often.</p>
        <Link
          href="/events"
          className="mt-1 text-sm font-semibold text-[#d99a45] hover:text-[#e8bd6b] hover:underline"
        >
          Browse all events
        </Link>
      </div>
    );
  }

  const event = events[index];

  return (
    <div className={`relative w-full ${aspect} rounded-2xl overflow-hidden bg-linear-to-br ${event.poster}`}>
      {event.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={event.id}
          src={event.imageUrl}
          alt={event.title}
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}
      <div className="absolute inset-0 bg-linear-to-t from-black/85 via-black/25 to-transparent" />

      <Link href={`/events/${event.id}`} className="absolute inset-0 flex flex-col justify-end p-5">
        <span className="self-start mb-2 text-[10px] font-bold uppercase tracking-widest bg-[#d99a45]/90 text-[#1a1206] px-2.5 py-1 rounded-full">
          Now booking
        </span>
        <p className="font-heading text-xl font-semibold leading-snug drop-shadow wrap-break-word">
          {event.title}
        </p>
        <p className="flex items-center gap-1.5 text-sm text-zinc-300 mt-1.5">
          <CalendarDays className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          {formatDateIST(event.startsAt)}
        </p>
        <p className="flex items-center gap-1.5 text-sm text-zinc-400 mt-0.5 wrap-break-word">
          <MapPin className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          {event.venue}
          {event.city ? `, ${event.city}` : ""}
        </p>
      </Link>

      {events.length > 1 && (
        <div className="absolute top-4 right-4 z-10 flex items-center gap-1.5 bg-white/10 backdrop-blur-md border border-white/15 rounded-full px-3 py-2">
          {events.map((e, i) => (
            <button
              key={e.id}
              onClick={() => setIndex(i)}
              aria-label={`Show ${e.title}`}
              className={`rounded-full transition-all duration-300 ${
                i === index ? "w-6 h-1.5 bg-white" : "w-1.5 h-1.5 bg-white/50 hover:bg-white/80"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
