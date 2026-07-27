import { VenueSection } from "@/lib/domain/venue";

interface Props {
  sections: VenueSection[];
  bookedSeatIds: string[];
}

/**
 * Read-only, BookMyShow-style seat diagram for "my booking" lookups: renders
 * the full venue layout (rows/columns labelled, wings divided) with the
 * customer's own seats highlighted, instead of a bare comma-separated seat-ID
 * string. No pricing, no hover/click states — purely "here's where you sit".
 */
export default function BookedSeatsDiagram({ sections, bookedSeatIds }: Props) {
  const mine = new Set(bookedSeatIds);

  return (
    <div className="overflow-x-auto pb-2">
      <div className="min-w-fit mx-auto flex flex-col items-center gap-1 bg-[#0d0a1f] rounded-xl px-4 py-5">
        {/* Stage — same orientation cue as the live seat map */}
        <div className="w-11/12 sm:w-4/5 mb-5">
          <div className="h-2.5 sm:h-3 rounded-t-[100%] bg-linear-to-r from-transparent via-[#60a5fa] to-transparent shadow-[0_10px_28px_rgba(96,165,250,0.5)]" />
          <p className="text-center text-[10px] sm:text-xs font-bold text-slate-300 mt-2 tracking-[0.3em] uppercase">
            Stage this way
          </p>
        </div>

        {sections.map((section) => (
          <div key={section.id || "main"} className="w-full flex flex-col items-center">
            {section.name && (
              <div className="w-full max-w-md text-center font-heading text-sm tracking-wide text-[#93c5fd] border-y border-[#3b82f6]/30 bg-[#3b82f6]/10 rounded-lg py-1 mt-3 mb-2">
                {section.name}
              </div>
            )}
            {section.rows.map((row) => (
              <div key={section.id + row.label} className="flex items-center gap-1">
                <span className="w-3.5 sm:w-4 text-[9px] sm:text-[10px] text-slate-400 text-right mr-0.5 shrink-0">
                  {row.label}
                </span>
                {row.groups.map((group, gi) => {
                  // Same fixed-width wing-slot + divider technique as the
                  // live SeatMap, so left/right wings line up the same way.
                  const prevGroup = row.groups[gi - 1];
                  const isWingBoundary =
                    gi > 0 && Boolean(prevGroup?.side) !== Boolean(group.side);
                  const seatEls = group.seats.map((seat) => {
                    const isMine = mine.has(seat.id);
                    const label = seat.side ? `${seat.side}${seat.number}` : String(seat.number);
                    return (
                      <span
                        key={seat.id}
                        title={isMine ? `${row.label}${label} · Your seat` : undefined}
                        className={`w-5 h-5 sm:w-6 sm:h-6 rounded-t text-[7px] sm:text-[9px] font-medium flex items-center justify-center shrink-0 ${
                          isMine
                            ? "bg-emerald-500 text-white ring-2 ring-emerald-300"
                            : "bg-white/10 text-slate-500"
                        }`}
                      >
                        {label}
                      </span>
                    );
                  });
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
            ))}
          </div>
        ))}

        <div className="flex items-center gap-1.5 mt-4 text-[11px] text-slate-300">
          <i className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" />
          Your seat{bookedSeatIds.length > 1 ? "s" : ""}
        </div>
      </div>
    </div>
  );
}
