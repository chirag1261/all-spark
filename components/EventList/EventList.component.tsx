"use client";

import { useMemo, useState } from "react";

import { MapPin, Zap } from "lucide-react";
import Link from "next/link";

import { minPrice, registrationState, totalSeats } from "@/lib/domain/events";
import { EventItem } from "@/types";
import { formatDateIST, inr } from "@/utils";

interface Props {
  events: EventItem[];
  /** eventId -> remaining seat count, computed server-side. */
  remaining: Record<string, number>;
  title?: string;
  showSearch?: boolean;
}

/**
 * Discovery grid — actionable event cards (16px-radius imagery, hover zoom,
 * real-time "Filling Fast" indicator, price accent) with pill-shaped city
 * filter tags. Filtering is purely client-side presentation; navigation and
 * data flow are unchanged.
 */
export default function EventList({
  events,
  remaining,
  title = "Upcoming events",
  showSearch = true,
}: Props) {
  const [query, setQuery] = useState("");
  const [city, setCity] = useState<string | null>(null);

  const cities = useMemo(
    () => [...new Set(events.map((e) => e.city).filter(Boolean))].sort(),
    [events]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events.filter((e) => {
      if (city && e.city !== city) return false;
      if (!q) return true;
      return [e.title, e.venue, e.city, e.description].join(" ").toLowerCase().includes(q);
    });
  }, [query, city, events]);

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-5">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
          <span className="inline-block w-8 h-1 rounded-full bg-linear-to-r from-[#d99a45] to-[#e8bd6b] align-middle mr-3" />
          {title}
        </h1>
        {showSearch && (
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search events, venues, cities…"
            className="sm:ml-auto w-full sm:w-80 bg-[#171228] border border-[#2a2450] rounded-full px-4 py-2.5 text-sm outline-none focus:border-[#d99a45] focus:shadow-[0_0_0_3px_rgba(217,154,69,0.15)] transition-shadow"
          />
        )}
      </div>

      {/* Pill filter tags — "what's happening near you" */}
      {showSearch && cities.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-8">
          <FilterPill active={city === null} onClick={() => setCity(null)}>
            Everywhere
          </FilterPill>
          {cities.map((c) => (
            <FilterPill key={c} active={city === c} onClick={() => setCity(city === c ? null : c)}>
              <MapPin className="w-3.5 h-3.5" aria-hidden="true" /> {c}
            </FilterPill>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="text-zinc-500 py-10 text-center">
          No events match{query ? ` “${query}”` : ""}
          {city ? ` in ${city}` : ""}.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((event) => {
            const left = remaining[event.id] ?? 0;
            const total = totalSeats(event);
            const soldOut = left <= 0;
            const fillingFast = !soldOut && (left <= 20 || left / Math.max(total, 1) <= 0.15);
            const reg = registrationState(event);
            const fromPrice = minPrice(event);
            return (
              <Link
                key={event.id}
                href={`/events/${event.id}`}
                className="group rounded-2xl bg-[#171228] border border-[#2a2450] hover:border-[#d99a45]/40 overflow-hidden shadow-lg hover:shadow-[0_16px_40px_rgba(0,0,0,0.45)] hover:-translate-y-1 transition-all duration-300"
              >
                <div
                  className={`relative aspect-video overflow-hidden bg-linear-to-br ${event.poster}`}
                >
                  {event.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={event.imageUrl}
                      alt={event.title}
                      className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  )}
                  <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent" />
                  <div className="absolute bottom-0 p-4 max-w-full">
                    <span className="text-lg font-extrabold leading-snug drop-shadow wrap-break-word">
                      {event.title}
                    </span>
                  </div>
                  {soldOut ? (
                    <span className="absolute top-3 right-3 bg-red-600 text-white text-[11px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full">
                      Sold out
                    </span>
                  ) : fillingFast ? (
                    <span className="absolute top-3 right-3 inline-flex items-center gap-1 bg-linear-to-r from-[#d99a45] to-[#e8bd6b] text-white text-[11px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full animate-[neon-pulse_2s_ease-in-out_infinite]">
                      <Zap className="w-3 h-3" aria-hidden="true" /> Filling fast
                    </span>
                  ) : null}
                  {reg === "upcoming" && (
                    <span className="absolute top-3 left-3 bg-sky-500/90 backdrop-blur text-white text-[11px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full">
                      Opens soon
                    </span>
                  )}
                  {reg === "closed" && !soldOut && (
                    <span className="absolute top-3 left-3 bg-zinc-800/90 backdrop-blur text-zinc-300 text-[11px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full">
                      Closed
                    </span>
                  )}
                </div>
                <div className="p-4 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{formatDateIST(event.startsAt)}</p>
                    <p className="text-sm text-zinc-400 wrap-break-word">
                      {event.venue}, {event.city}
                    </p>
                    {fillingFast && (
                      <p className="text-xs text-[#ffce7a] mt-1">Only {left} seats left</p>
                    )}
                  </div>
                  <span className="shrink-0 text-sm font-bold text-[#d99a45] bg-[#d99a45]/10 border border-[#d99a45]/20 rounded-full px-3 py-1">
                    {inr(fromPrice)}+
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-full px-4 py-1.5 text-sm font-medium border transition-all duration-200 ${
        active
          ? "bg-linear-to-r from-[#d99a45] to-[#e8bd6b] border-transparent text-white shadow-lg shadow-[#d99a45]/25"
          : "bg-[#171228] border-[#2a2450] text-zinc-400 hover:text-zinc-100 hover:border-zinc-600"
      }`}
    >
      {children}
    </button>
  );
}
