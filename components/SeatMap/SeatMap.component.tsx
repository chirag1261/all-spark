"use client";

import { buildVenue } from "@/lib/domain/venue";
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
  { avail: "bg-amber-400/25 text-amber-100 hover:bg-amber-400/50", swatch: "bg-amber-400" },
  { avail: "bg-sky-500/25 text-sky-100 hover:bg-sky-500/50", swatch: "bg-sky-500" },
  { avail: "bg-violet-500/30 text-violet-100 hover:bg-violet-500/55", swatch: "bg-violet-500" },
  { avail: "bg-rose-500/25 text-rose-100 hover:bg-rose-500/50", swatch: "bg-rose-500" },
  { avail: "bg-cyan-500/25 text-cyan-100 hover:bg-cyan-500/50", swatch: "bg-cyan-500" },
  { avail: "bg-fuchsia-500/25 text-fuchsia-100 hover:bg-fuchsia-500/50", swatch: "bg-fuchsia-500" },
];

export default function SeatMap({ event, bookedSeats, lockedSeats, selected, onToggle }: Props) {
  const venue = buildVenue(event);

  // Assign a colour per price, priciest first, shared across sections at the
  // same price so the colour reads as the ticket class everywhere.
  const prices = [...new Set(venue.seats.map((s) => s.price))].sort((a, b) => b - a);
  const styleForPrice = (price: number) => TIER_STYLES[prices.indexOf(price) % TIER_STYLES.length];

  return (
    <div className="overflow-x-auto pb-4">
      <div className="min-w-fit mx-auto flex flex-col items-center gap-1.5">
        {/* Price-tier colour key */}
        <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 mb-6 text-xs">
          {venue.tiers.map((tier) => (
            <span key={tier.id + tier.price} className="flex items-center gap-1.5 text-zinc-300">
              <i className={`w-3.5 h-3.5 rounded-sm inline-block ${styleForPrice(tier.price).swatch}`} />
              {tier.name} · <span className="font-semibold">{inr(tier.price)}</span>
            </span>
          ))}
        </div>

        {/* Stage */}
        <div className="w-3/5 mb-6">
          <div className="h-1.5 rounded-[50%] bg-linear-to-r from-transparent via-[#d99a45] to-transparent shadow-[0_8px_24px_rgba(217,154,69,0.4)]" />
          <p className="text-center text-[11px] text-zinc-500 mt-2 tracking-widest uppercase">
            Stage this way
          </p>
        </div>

        {venue.sections.map((section) => {
          let lastPrice: number | null = null;
          return (
            <div key={section.id || "main"} className="w-full flex flex-col items-center">
              {section.name && (
                <div className="w-full max-w-md text-center font-heading text-base tracking-wide text-[#d99a45] border-y border-[#d99a45]/20 bg-[#d99a45]/5 rounded-lg py-1.5 mt-6 mb-3">
                  {section.name}
                </div>
              )}
              {section.rows.map((row) => {
                // Tier divider whenever the price changes down the section.
                const showTier = row.price !== lastPrice;
                lastPrice = row.price;
                return (
                  <div key={section.id + row.label} className="w-full flex flex-col items-center">
                    {showTier && (
                      <div className="flex items-center justify-center gap-2 text-[11px] uppercase tracking-widest text-zinc-500 mb-2 mt-3">
                        <i className={`w-2.5 h-2.5 rounded-sm ${styleForPrice(row.price).swatch}`} />
                        {row.tierName ? `${row.tierName} · ` : ""}
                        {inr(row.price)}
                      </div>
                    )}
                    <div className="flex items-center gap-1.5">
                      <span className="w-6 text-xs text-zinc-500 text-right mr-1 shrink-0">
                        {row.label}
                      </span>
                      {row.groups.map((group, gi) => (
                        <div
                          key={gi}
                          className={`flex items-center gap-1.5 ${gi > 0 ? "ml-5" : ""} ${
                            group.side ? "px-1.5 rounded bg-white/[0.03]" : ""
                          }`}
                        >
                          {group.seats.map((seat) => (
                            <SeatButton
                              key={seat.id}
                              seat={seat}
                              availClass={styleForPrice(seat.price).avail}
                              state={
                                selected.has(seat.id)
                                  ? "selected"
                                  : seat.blocked || bookedSeats.has(seat.id)
                                    ? "booked"
                                    : lockedSeats.has(seat.id)
                                      ? "locked"
                                      : "available"
                              }
                              onToggle={onToggle}
                            />
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}

        {/* State legend */}
        <div className="flex flex-wrap justify-center gap-5 mt-8 text-xs text-zinc-400">
          <span className="flex items-center gap-1.5">
            <i className="w-3.5 h-3.5 rounded-sm bg-zinc-600/70 inline-block" /> Available (coloured
            by price above)
          </span>
          <span className="flex items-center gap-1.5">
            <i className="w-3.5 h-3.5 rounded-sm bg-emerald-500 inline-block" /> Your selection
          </span>
          <span className="flex items-center gap-1.5">
            <i className="w-3.5 h-3.5 rounded-sm bg-amber-950 inline-block" /> Held
          </span>
          <span className="flex items-center gap-1.5">
            <i className="w-3.5 h-3.5 rounded-sm bg-zinc-800 inline-block" /> Sold / blocked
          </span>
        </div>
      </div>
    </div>
  );
}

type SeatUiState = "available" | "selected" | "locked" | "booked";

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
  const unavailable = state === "booked" || state === "locked";
  const label = seat.side ? `${seat.side}${seat.number}` : String(seat.number);
  return (
    <button
      disabled={unavailable}
      onClick={() => onToggle(seat.id)}
      aria-label={`Seat ${seat.rowLabel}${label} · ${inr(seat.price)} · ${state}`}
      title={`${seat.rowLabel}${label} · ${inr(seat.price)}`}
      className={[
        "w-7 h-7 rounded-t-md text-[10px] font-medium transition-all shrink-0",
        state === "booked"
          ? "bg-zinc-800 text-zinc-700 cursor-not-allowed"
          : state === "locked"
            ? "bg-amber-950 text-amber-800 cursor-not-allowed"
            : state === "selected"
              ? "bg-emerald-500 text-emerald-950 ring-2 ring-emerald-300 scale-110 cursor-pointer"
              : `${availClass} cursor-pointer`,
      ].join(" ")}
    >
      {label}
    </button>
  );
}
