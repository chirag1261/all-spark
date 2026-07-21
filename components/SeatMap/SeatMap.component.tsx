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

export default function SeatMap({ event, bookedSeats, lockedSeats, selected, onToggle }: Props) {
  const venue = buildVenue(event);

  return (
    <div className="overflow-x-auto pb-4">
      <div className="min-w-fit mx-auto flex flex-col items-center gap-1.5">
        {/* Stage */}
        <div className="w-3/5 mb-6">
          <div className="h-1.5 rounded-[50%] bg-linear-to-r from-transparent via-sky-400 to-transparent shadow-[0_8px_24px_rgba(56,189,248,0.4)]" />
          <p className="text-center text-[11px] text-zinc-500 mt-2 tracking-widest uppercase">
            Stage this way
          </p>
        </div>

        {venue.sections.map((section) => {
          let lastPrice: number | null = null;
          return (
            <div key={section.id || "main"} className="w-full flex flex-col items-center">
              {section.name && (
                <div className="w-full max-w-md text-center text-xs font-bold uppercase tracking-[0.2em] text-zinc-300 bg-zinc-900/60 border border-zinc-800 rounded-lg py-1.5 mt-6 mb-3">
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
                      <div className="w-full text-center text-[11px] uppercase tracking-widest text-zinc-500 border-b border-zinc-800 mb-2 mt-3 pb-1">
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

        {/* Legend */}
        <div className="flex flex-wrap justify-center gap-5 mt-6 text-xs text-zinc-400">
          <span className="flex items-center gap-1.5">
            <i className="w-3.5 h-3.5 rounded-sm bg-zinc-700/60 inline-block" /> Available
          </span>
          <span className="flex items-center gap-1.5">
            <i className="w-3.5 h-3.5 rounded-sm bg-emerald-500 inline-block" /> Selected
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
  onToggle,
}: {
  seat: Seat;
  state: SeatUiState;
  onToggle: (seatId: string) => void;
}) {
  const unavailable = state === "booked" || state === "locked";
  const label = seat.side ? `${seat.side}${seat.number}` : String(seat.number);
  return (
    <button
      disabled={unavailable}
      onClick={() => onToggle(seat.id)}
      aria-label={`Seat ${seat.rowLabel}${label} ${state}`}
      title={`${seat.rowLabel}${label} · ${inr(seat.price)}`}
      className={[
        "w-7 h-7 rounded-t-md text-[10px] font-medium transition-colors shrink-0",
        state === "booked"
          ? "bg-zinc-800 text-zinc-700 cursor-not-allowed"
          : state === "locked"
            ? "bg-amber-950 text-amber-800 cursor-not-allowed"
            : state === "selected"
              ? "bg-emerald-500 text-emerald-950"
              : "bg-zinc-700/60 text-zinc-300 hover:bg-emerald-800",
      ].join(" ")}
    >
      {label}
    </button>
  );
}
