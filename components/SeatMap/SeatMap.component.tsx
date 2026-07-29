"use client";

import { useEffect, useRef, useState } from "react";

import { createPortal } from "react-dom";

import { buildVenue, Venue } from "@/lib/domain/venue";
import { EventItem, Seat } from "@/types";
import { inr } from "@/utils";

interface Props {
  event: EventItem;
  bookedSeats: Set<string>;
  lockedSeats: Set<string>;
  selected: Set<string>;
  onToggle: (seatId: string) => void;
}

/** Distinct hues per price tier — chosen to stay clear of the selected (emerald),
 *  held (amber) and sold (zinc) states so a seat's colour always means its price. */
const TIER_STYLES = [
  { avail: "bg-amber-100 text-amber-800 hover:bg-amber-200", swatch: "bg-amber-500" },
  { avail: "bg-sky-100 text-sky-800 hover:bg-sky-200", swatch: "bg-sky-500" },
  { avail: "bg-violet-100 text-violet-800 hover:bg-violet-200", swatch: "bg-violet-500" },
  { avail: "bg-rose-100 text-rose-800 hover:bg-rose-200", swatch: "bg-rose-500" },
  { avail: "bg-cyan-100 text-cyan-800 hover:bg-cyan-200", swatch: "bg-cyan-500" },
  { avail: "bg-fuchsia-100 text-fuchsia-800 hover:bg-fuchsia-200", swatch: "bg-fuchsia-500" },
];

export default function SeatMap({ event, bookedSeats, lockedSeats, selected, onToggle }: Props) {
  const venue = buildVenue(event);

  // BookMyShow-style scroll affordances for a wide seat grid on narrow
  // screens: edge-fade hints, plus a mini-map (shown WHILE actively
  // scrolling, like BookMyShow's own seat map) previewing the whole layout
  // with the currently-visible slice boxed off — all hidden once everything
  // fits on screen already.
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrolling, setScrolling] = useState(false);
  const scrollIdleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [scrollState, setScrollState] = useState({
    canLeft: false,
    canRight: false,
    hasOverflow: false,
    thumbWidthPct: 100,
    thumbLeftPct: 0,
  });

  const measureScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const thumbWidthPct = Math.max(15, Math.min(100, (el.clientWidth / el.scrollWidth) * 100));
    const pct = max > 0 ? el.scrollLeft / max : 0;
    const canLeft = el.scrollLeft > 4;
    const canRight = el.scrollLeft < max - 4;
    setScrollState({
      canLeft,
      canRight,
      hasOverflow: canLeft || canRight,
      thumbWidthPct,
      thumbLeftPct: pct * (100 - thumbWidthPct),
    });
  };

  const onScroll = () => {
    measureScroll();
    setScrolling(true);
    if (scrollIdleTimer.current) clearTimeout(scrollIdleTimer.current);
    scrollIdleTimer.current = setTimeout(() => setScrolling(false), 900);
  };

  useEffect(() => {
    measureScroll();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", measureScroll);
    return () => {
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", measureScroll);
      if (scrollIdleTimer.current) clearTimeout(scrollIdleTimer.current);
    };
    // Re-measure whenever the venue changes shape (its width depends on
    // `venue`, which this mount-time effect can't otherwise see).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venue]);

  // Assign a colour per price, priciest first, shared across sections at the
  // same price so the colour reads as the ticket class everywhere.
  const prices = [...new Set(venue.seats.map((s) => s.price))].sort((a, b) => b - a);
  const styleForPrice = (price: number) => TIER_STYLES[prices.indexOf(price) % TIER_STYLES.length];

  return (
    <div className="relative">
      {scrollState.hasOverflow && (
        <p className="sm:hidden text-center text-[11px] text-slate-400 mb-2">
          ← Swipe to see all seats →
        </p>
      )}

      <div className="relative">
        {scrollState.canLeft && (
          <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-linear-to-r from-[#0d0a1f] to-transparent z-10" />
        )}
        {scrollState.canRight && (
          <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-linear-to-l from-[#0d0a1f] to-transparent z-10" />
        )}
        {scrollState.hasOverflow && scrolling && (
          <SeatMiniMap
            venue={venue}
            bookedSeats={bookedSeats}
            lockedSeats={lockedSeats}
            selected={selected}
            thumbWidthPct={scrollState.thumbWidthPct}
            thumbLeftPct={scrollState.thumbLeftPct}
          />
        )}

        <div ref={scrollRef} className="overflow-x-auto pb-4">
          <div className="min-w-fit mx-auto flex flex-col items-center gap-1">
            {/* Price-tier colour key */}
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 mb-4 text-[11px] sm:text-xs">
              {venue.tiers.map((tier) => (
                <span
                  key={tier.id + tier.price}
                  className="flex items-center gap-1.5 text-slate-200"
                >
                  <i
                    className={`w-3 h-3 rounded-sm inline-block ${styleForPrice(tier.price).swatch}`}
                  />
                  {tier.name} · <span className="font-semibold">{inr(tier.price)}</span>
                </span>
              ))}
            </div>

            {/* Stage — a big curved "screen" bar, BookMyShow-style */}
            <div className="w-11/12 sm:w-4/5 mb-6">
              <div className="h-3 sm:h-4 rounded-t-[100%] bg-linear-to-r from-transparent via-[#60a5fa] to-transparent shadow-[0_12px_36px_rgba(96,165,250,0.55)]" />
              <p className="text-center text-xs sm:text-sm font-bold text-slate-300 mt-2.5 tracking-[0.3em] uppercase">
                Stage this way
              </p>
            </div>

            {venue.sections.map((section) => {
              let lastPrice: number | null = null;
              return (
                <div key={section.id || "main"} className="w-full flex flex-col items-center">
                  {section.name && (
                    <div className="w-full max-w-md text-center font-heading text-sm tracking-wide text-[#93c5fd] border-y border-[#3b82f6]/30 bg-[#3b82f6]/10 rounded-lg py-1 mt-4 mb-2">
                      {section.name}
                    </div>
                  )}
                  {section.rows.map((row) => {
                    // Tier divider whenever the price changes down the section.
                    const showTier = row.price !== lastPrice;
                    lastPrice = row.price;
                    return (
                      <div
                        key={section.id + row.label}
                        className="w-full flex flex-col items-center"
                      >
                        {showTier && (
                          <div className="flex items-center justify-center gap-1.5 text-[10px] uppercase tracking-widest text-slate-400 mb-1.5 mt-2">
                            <i
                              className={`w-2 h-2 rounded-sm ${styleForPrice(row.price).swatch}`}
                            />
                            {row.tierName ? `${row.tierName} · ` : ""}
                            {inr(row.price)}
                          </div>
                        )}
                        {/* w-full + a shrink-0 label pins every row's label to
                            the same left edge; only the seat groups (in the
                            flex-1 wrapper) centre within what's left. Without
                            this, a shorter row (e.g. a blocked front row)
                            centres its whole label+seats block as one unit
                            and its label ends up nowhere near the rows below. */}
                        <div className="w-full flex items-center gap-1">
                          <span className="w-3.5 sm:w-4 text-[9px] sm:text-[10px] text-slate-400 text-right mr-0.5 shrink-0">
                            {row.label}
                          </span>
                          <div className="flex-1 flex items-center justify-center gap-1">
                            {row.groups.map((group, gi) => {
                            // A wing (side) group butting up against the main
                            // block, or vice versa, gets a solid divider line so
                            // the left/right wings read as clearly separate from
                            // the centre block. The wing itself sits in a
                            // fixed-width slot (rather than shrinking to its own
                            // seat count) so the divider lands at the same
                            // x-position on every row — and hugs whichever edge
                            // of that slot actually borders the divider (the
                            // right edge when the wing opens the row, the left
                            // edge when it closes it), so there's no gap between
                            // the line and the wing box on either side.
                            const prevGroup = row.groups[gi - 1];
                            const isWingBoundary =
                              gi > 0 && Boolean(prevGroup?.side) !== Boolean(group.side);
                            const seatEls = group.seats.map((seat) => (
                              <SeatButton
                                key={seat.id}
                                seat={seat}
                                availClass={styleForPrice(seat.price).avail}
                                state={
                                  seat.bookMyShowOnly
                                    ? "bookMyShow"
                                    : selected.has(seat.id)
                                      ? "selected"
                                      : seat.blocked || bookedSeats.has(seat.id)
                                        ? "booked"
                                        : lockedSeats.has(seat.id)
                                          ? "locked"
                                          : "available"
                                }
                                onToggle={onToggle}
                              />
                            ));
                            return (
                              <div key={gi} className="flex items-center">
                                {isWingBoundary && (
                                  <span
                                    aria-hidden="true"
                                    className="self-stretch w-px bg-white mx-2 sm:mx-3"
                                  />
                                )}
                                {group.side ? (
                                  <div
                                    className={`w-40 sm:w-48 shrink-0 flex ${gi === 0 ? "justify-end" : "justify-start"}`}
                                  >
                                    <div className="flex items-center gap-1 px-1.5 py-1 rounded-md border border-white/25 bg-white/5">
                                      {seatEls}
                                    </div>
                                  </div>
                                ) : (
                                  <div
                                    className={`flex items-center gap-1 ${gi > 0 && !isWingBoundary ? "ml-2.5 sm:ml-3.5" : ""}`}
                                  >
                                    {seatEls}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}

            {/* State legend */}
            <div className="flex flex-wrap justify-center gap-4 mt-6 text-[11px] sm:text-xs text-slate-300">
              <span className="flex items-center gap-1.5">
                <i className="w-3 h-3 rounded-sm bg-slate-300 inline-block" /> Available (coloured
                by price above)
              </span>
              <span className="flex items-center gap-1.5">
                <i className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" /> Your selection
              </span>
              <span className="flex items-center gap-1.5">
                <i className="w-3 h-3 rounded-sm bg-amber-300 inline-block" /> Held
              </span>
              <span className="flex items-center gap-1.5">
                <i className="w-3 h-3 rounded-sm bg-slate-600 inline-block" /> Sold / blocked
              </span>
              <span className="flex items-center gap-1.5">
                <i className="w-3 h-3 rounded-sm bg-black inline-block" /> Book via BookMyShow
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** BookMyShow-style scroll thumbnail: the whole layout shrunk to one tiny
 *  square per seat (coloured the same as the real map — available/selected/
 *  sold/held), with a red-boxed window over whichever horizontal slice is
 *  currently in view. Shown WHILE actively scrolling, floated near the top. */
function SeatMiniMap({
  venue,
  bookedSeats,
  lockedSeats,
  selected,
  thumbWidthPct,
  thumbLeftPct,
}: {
  venue: Venue;
  bookedSeats: Set<string>;
  lockedSeats: Set<string>;
  selected: Set<string>;
  thumbWidthPct: number;
  thumbLeftPct: number;
}) {
  const rows = venue.sections.flatMap((s) => s.rows);
  const maxSeats = Math.max(1, ...rows.map((r) => r.groups.reduce((n, g) => n + g.seats.length, 0)));

  const colorFor = (seat: Seat) => {
    if (seat.bookMyShowOnly) return "bg-black";
    if (selected.has(seat.id)) return "bg-emerald-500";
    if (seat.blocked || bookedSeats.has(seat.id)) return "bg-slate-600";
    if (lockedSeats.has(seat.id)) return "bg-amber-400";
    return "bg-slate-300";
  };

  // Portal to <body> — position: fixed is relative to the nearest ancestor
  // with a transform/filter/backdrop-blur (the seat map's own dark card, or
  // any wrapper above it, could easily have one), not necessarily the
  // viewport. Escaping to <body> guarantees it stays pinned to the actual
  // screen — visible no matter how far down the page you've scrolled —
  // rather than scrolling away with whichever box it happened to inherit.
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed left-1/2 -translate-x-1/2 top-20 z-50 w-40 sm:w-52 bg-black/85 backdrop-blur-sm border border-white/20 rounded-lg p-2 pointer-events-none shadow-2xl">
      {/* Screen/stage — same blue accent as the real stage bar, so the mini-map
          also shows which end of the venue you're facing. */}
      <div className="h-0.75 rounded-t-full bg-linear-to-r from-transparent via-[#60a5fa] to-transparent mb-1.5" />
      <div className="relative space-y-px">
        {rows.map((row, i) => {
          const seats = row.groups.flatMap((g) => g.seats);
          const widthPct = Math.max(15, (seats.length / maxSeats) * 100);
          return (
            <div
              key={i}
              className="mx-auto flex justify-center gap-px"
              style={{ width: `${widthPct}%` }}
            >
              {seats.map((seat) => (
                <span key={seat.id} className={`h-0.75 flex-1 rounded-xs ${colorFor(seat)}`} />
              ))}
            </div>
          );
        })}
        {/* The currently-visible horizontal slice, boxed off like BookMyShow's own thumbnail. */}
        <div
          className="pointer-events-none absolute inset-y-0 border-2 border-red-500 rounded-xs"
          style={{ left: `${thumbLeftPct}%`, width: `${thumbWidthPct}%` }}
        />
      </div>
    </div>,
    document.body
  );
}

type SeatUiState = "available" | "selected" | "locked" | "booked" | "bookMyShow";

function SeatButton({
  seat,
  state,
  availClass,
  onToggle,
}: {
  seat: Seat;
  state: SeatUiState;
  availClass: string;
  onToggle: (seatId: string) => void;
}) {
  const unavailable = state === "booked" || state === "locked" || state === "bookMyShow";
  const label = seat.side ? `${seat.side}${seat.number}` : String(seat.number);
  const description = state === "bookMyShow" ? "Book via BookMyShow" : `${inr(seat.price)} · ${state}`;
  return (
    <button
      disabled={unavailable}
      onClick={() => onToggle(seat.id)}
      aria-label={`Seat ${seat.rowLabel}${label} · ${description}`}
      title={`${seat.rowLabel}${label} · ${description}`}
      className={[
        "w-5 h-5 sm:w-6 sm:h-6 rounded-t text-[7px] sm:text-[9px] font-medium transition-all shrink-0",
        state === "bookMyShow"
          ? "bg-black text-white/60 cursor-not-allowed"
          : state === "booked"
            ? "bg-slate-700 text-slate-500 cursor-not-allowed"
            : state === "locked"
              ? "bg-amber-200 text-amber-700 cursor-not-allowed"
              : state === "selected"
                ? "bg-emerald-500 text-white ring-2 ring-emerald-300 scale-110 cursor-pointer"
                : `${availClass} cursor-pointer`,
      ].join(" ")}
    >
      {label}
    </button>
  );
}
