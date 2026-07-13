"use client";

import { Seat, SeatTier } from "@/lib/types";
import { getSeatLayout, SEATS_PER_ROW } from "@/lib/data";

const TIER_LABELS: Record<SeatTier, string> = {
  RECLINER: "Recliner",
  GOLD: "Gold",
  SILVER: "Silver",
};

interface Props {
  bookedSeats: Set<string>;
  lockedSeats: Set<string>;
  selected: Set<string>;
  onToggle: (seatId: string) => void;
  prices: Record<SeatTier, number>; // paise
}

export default function SeatMap({ bookedSeats, lockedSeats, selected, onToggle, prices }: Props) {
  const layout = getSeatLayout();
  const rows = new Map<string, Seat[]>();
  for (const seat of layout) {
    if (!rows.has(seat.row)) rows.set(seat.row, []);
    rows.get(seat.row)!.push(seat);
  }

  let lastTier: SeatTier | null = null;

  return (
    <div className="overflow-x-auto pb-4">
      <div className="min-w-[560px] flex flex-col items-center gap-1.5">
        {[...rows.entries()].map(([row, seats]) => {
          const tier = seats[0].tier;
          const showTierHeader = tier !== lastTier;
          lastTier = tier;
          return (
            <div key={row} className="w-full flex flex-col items-center">
              {showTierHeader && (
                <div className="w-full text-center text-[11px] uppercase tracking-widest text-zinc-500 border-b border-zinc-800 mb-2 mt-3 pb-1">
                  {TIER_LABELS[tier]} · ₹{(prices[tier] / 100).toFixed(0)}
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <span className="w-5 text-xs text-zinc-500 text-right mr-1">{row}</span>
                {seats.map((seat) => {
                  const isBooked = bookedSeats.has(seat.id);
                  const isLocked = lockedSeats.has(seat.id) && !selected.has(seat.id);
                  const isSelected = selected.has(seat.id);
                  const unavailable = isBooked || isLocked;
                  return (
                    <button
                      key={seat.id}
                      disabled={unavailable}
                      onClick={() => onToggle(seat.id)}
                      aria-label={`Seat ${seat.id} ${
                        isBooked ? "booked" : isLocked ? "held" : isSelected ? "selected" : "available"
                      }`}
                      className={[
                        "w-7 h-7 rounded-t-md text-[10px] font-medium transition-colors",
                        seat.number === SEATS_PER_ROW / 2 + 1 ? "ml-5" : "",
                        isBooked
                          ? "bg-zinc-800 text-zinc-700 cursor-not-allowed"
                          : isLocked
                          ? "bg-amber-950 text-amber-800 cursor-not-allowed"
                          : isSelected
                          ? "bg-emerald-500 text-emerald-950"
                          : "bg-zinc-700/60 text-zinc-300 hover:bg-emerald-800",
                      ].join(" ")}
                    >
                      {seat.number}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Screen */}
        <div className="mt-8 w-3/5">
          <div className="h-1.5 rounded-[50%] bg-gradient-to-r from-transparent via-sky-400 to-transparent shadow-[0_-8px_24px_rgba(56,189,248,0.4)]" />
          <p className="text-center text-[11px] text-zinc-500 mt-2 tracking-widest uppercase">
            All eyes this way please
          </p>
        </div>

        {/* Legend */}
        <div className="flex gap-5 mt-4 text-xs text-zinc-400">
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
            <i className="w-3.5 h-3.5 rounded-sm bg-zinc-800 inline-block" /> Sold
          </span>
        </div>
      </div>
    </div>
  );
}
