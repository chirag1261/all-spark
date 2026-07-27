"use client";

import { Plus, X } from "lucide-react";

import { buildVenue } from "@/lib/domain/venue";
import { BABU_JAGAJEEVANRAM_LAYOUT } from "@/lib/domain/venues";
import { EventItem, EventLayout, LayoutRow, LayoutSection, SeatSegment, SeatTier } from "@/types";
import { inr } from "@/utils";

interface Props {
  value: EventLayout;
  onChange: (layout: EventLayout) => void;
}

const clone = (l: EventLayout): EventLayout => JSON.parse(JSON.stringify(l));
const inputCls =
  "bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm outline-none focus:border-[#1d4ed8]";

/**
 * Structured builder for a rich multi-section seating layout. Everything the
 * seat engine understands — sections, price tiers, rows, aisle-split segments,
 * left/right side wings and per-row/segment blocking — is editable here, with a
 * live capacity readout derived from the same `buildVenue` the app renders from.
 */
export default function LayoutEditor({ value, onChange }: Props) {
  const venue = buildVenue({
    layout: value,
    categories: [],
    blockedSeats: [],
  } as unknown as EventItem);
  const physical = venue.seats.length;

  const mutate = (fn: (draft: EventLayout) => void) => {
    const draft = clone(value);
    fn(draft);
    onChange(draft);
  };

  const addSection = () =>
    mutate((d) => {
      const n = d.sections.length + 1;
      d.sections.push({
        id: `S${n}`,
        name: `Section ${n}`,
        tiers: [{ id: `t_${n}_1`, name: "Standard", price: 50000 }],
        rows: [],
      });
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="text-sm">
          <span className="text-slate-600">Capacity: </span>
          <span className="font-semibold">{venue.sellable.toLocaleString("en-IN")}</span>
          <span className="text-slate-800"> on sale</span>
          <span className="text-slate-700"> · {physical.toLocaleString("en-IN")} total</span>
        </div>
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={() => onChange(clone(BABU_JAGAJEEVANRAM_LAYOUT))}
            className="text-sm border border-slate-300 hover:border-slate-400 rounded-lg px-3 py-1.5 text-slate-700"
          >
            Load auditorium template
          </button>
          <button
            type="button"
            onClick={addSection}
            className="inline-flex items-center gap-1 text-sm bg-[#1d4ed8] hover:bg-[#1e40af] text-white rounded-lg px-3 py-1.5 font-semibold"
          >
            <Plus className="w-3.5 h-3.5" /> Section
          </button>
        </div>
      </div>

      {value.sections.length === 0 && (
        <p className="text-sm text-slate-800 border border-dashed border-slate-200 rounded-xl px-4 py-8 text-center">
          No sections yet — add one, or load the auditorium template.
        </p>
      )}

      {value.sections.map((section, si) => (
        <SectionCard
          key={si}
          section={section}
          onChange={(next) =>
            mutate((d) => {
              d.sections[si] = next;
            })
          }
          onRemove={() =>
            mutate((d) => {
              d.sections.splice(si, 1);
            })
          }
        />
      ))}
    </div>
  );
}

function SectionCard({
  section,
  onChange,
  onRemove,
}: {
  section: LayoutSection;
  onChange: (s: LayoutSection) => void;
  onRemove: () => void;
}) {
  const patch = (fn: (draft: LayoutSection) => void) => {
    const draft: LayoutSection = JSON.parse(JSON.stringify(section));
    fn(draft);
    onChange(draft);
  };

  return (
    <div className="border border-slate-200 rounded-xl p-4 space-y-3 bg-white/80">
      <div className="flex items-center gap-2">
        <input
          value={section.name}
          onChange={(e) => patch((d) => (d.name = e.target.value))}
          placeholder="Section name (e.g. Lower Floor)"
          className={`${inputCls} flex-1 font-semibold`}
        />
        <input
          value={section.id}
          onChange={(e) =>
            patch(
              (d) =>
                (d.id = e.target.value
                  .toUpperCase()
                  .replace(/[^A-Z0-9]/g, "")
                  .slice(0, 8))
            )
          }
          placeholder="CODE"
          title="Seat-id prefix (letters/digits)"
          className={`${inputCls} w-20 font-mono`}
        />
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove section"
          className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-slate-800 hover:text-red-700"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tiers */}
      <div>
        <p className="text-[12px] uppercase tracking-widest text-slate-800 mb-1.5">Price tiers</p>
        <div className="flex flex-wrap gap-2">
          {section.tiers.map((tier, ti) => (
            <div
              key={ti}
              className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2 py-1"
            >
              <input
                value={tier.name}
                onChange={(e) =>
                  patch((d) => (d.tiers[ti] = { ...d.tiers[ti], name: e.target.value }))
                }
                placeholder="Name"
                className="bg-transparent w-24 text-sm outline-none"
              />
              <span className="text-slate-800 text-sm">₹</span>
              <input
                type="number"
                min={1}
                value={tier.price / 100}
                onChange={(e) =>
                  patch(
                    (d) =>
                      (d.tiers[ti] = {
                        ...d.tiers[ti],
                        price: Math.round(Number(e.target.value) * 100),
                      })
                  )
                }
                className="bg-transparent w-20 text-sm outline-none"
              />
              <button
                type="button"
                onClick={() => patch((d) => d.tiers.splice(ti, 1))}
                aria-label="Remove tier"
                className="text-slate-700 hover:text-red-700"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              patch((d) =>
                d.tiers.push({
                  id: `t_${d.tiers.length + 1}_${Date.now() % 1000}`,
                  name: "Tier",
                  price: 50000,
                })
              )
            }
            className="inline-flex items-center gap-1 text-sm border border-slate-300 hover:border-slate-400 rounded-lg px-2.5 py-1 text-slate-700"
          >
            <Plus className="w-3.5 h-3.5" /> Tier
          </button>
        </div>
      </div>

      {/* Rows */}
      <div>
        <p className="text-[12px] uppercase tracking-widest text-slate-800 mb-1.5">Rows</p>
        <div className="space-y-1.5">
          {section.rows.map((row, ri) => (
            <RowEditor
              key={ri}
              row={row}
              tiers={section.tiers}
              onChange={(next) => patch((d) => (d.rows[ri] = next))}
              onRemove={() => patch((d) => d.rows.splice(ri, 1))}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() =>
            patch((d) =>
              d.rows.push({
                label: nextRowLabel(d.rows),
                tierId: d.tiers[0]?.id ?? "",
                segments: [{ count: 10 }],
              })
            )
          }
          className="mt-2 inline-flex items-center gap-1 text-sm border border-slate-300 hover:border-slate-400 rounded-lg px-2.5 py-1 text-slate-700"
        >
          <Plus className="w-3.5 h-3.5" /> Row
        </button>
      </div>
    </div>
  );
}

function RowEditor({
  row,
  tiers,
  onChange,
  onRemove,
}: {
  row: LayoutRow;
  tiers: SeatTier[];
  onChange: (r: LayoutRow) => void;
  onRemove: () => void;
}) {
  const patch = (fn: (draft: LayoutRow) => void) => {
    const draft: LayoutRow = JSON.parse(JSON.stringify(row));
    fn(draft);
    onChange(draft);
  };
  const rowSeats = row.segments.reduce((n, s) => n + (Number(s.count) || 0), 0);

  return (
    <div className="flex flex-wrap items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5">
      <input
        value={row.label}
        onChange={(e) => patch((d) => (d.label = e.target.value.toUpperCase().slice(0, 3)))}
        className={`${inputCls} w-12 text-center font-mono`}
        aria-label="Row label"
      />
      <select
        value={row.tierId}
        onChange={(e) => patch((d) => (d.tierId = e.target.value))}
        className={inputCls}
        aria-label="Row price tier"
      >
        {tiers.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name} · {inr(t.price)}
          </option>
        ))}
      </select>
      <label className="flex items-center gap-1 text-sm text-slate-600 px-1">
        <input
          type="checkbox"
          checked={Boolean(row.blocked)}
          onChange={(e) => patch((d) => (d.blocked = e.target.checked || undefined))}
          className="accent-[#1d4ed8]"
        />
        Block row
      </label>
      <label
        className="flex items-center gap-1 text-sm text-slate-600 px-1"
        title="Reserved for the BookMyShow channel — off-sale here, shown as a black seat"
      >
        <input
          type="checkbox"
          checked={Boolean(row.bookMyShowOnly)}
          onChange={(e) => patch((d) => (d.bookMyShowOnly = e.target.checked || undefined))}
          className="accent-black"
        />
        BookMyShow only
      </label>

      <span className="text-slate-700">·</span>

      {row.segments.map((seg, gi) => (
        <div
          key={gi}
          className="flex items-center gap-1 bg-white border border-slate-200 rounded px-1.5 py-0.5"
        >
          <input
            type="number"
            min={1}
            value={seg.count}
            onChange={(e) =>
              patch((d) => (d.segments[gi] = { ...d.segments[gi], count: Number(e.target.value) }))
            }
            className="bg-transparent w-12 text-sm outline-none text-center"
            aria-label="Seats in block"
          />
          <select
            value={seg.side ?? ""}
            onChange={(e) =>
              patch(
                (d) =>
                  (d.segments[gi] = {
                    ...d.segments[gi],
                    side: (e.target.value || undefined) as SeatSegment["side"],
                  })
              )
            }
            className="bg-transparent text-sm outline-none text-slate-600"
            aria-label="Block placement"
          >
            <option value="">Center</option>
            <option value="L">Left</option>
            <option value="R">Right</option>
          </select>
          <button
            type="button"
            onClick={() =>
              patch(
                (d) => (d.segments[gi] = { ...d.segments[gi], blocked: !d.segments[gi].blocked })
              )
            }
            title={seg.blocked ? "Blocked — click to unblock" : "On sale — click to block"}
            className={`text-sm px-1 rounded ${seg.blocked ? "text-red-700" : "text-slate-700 hover:text-slate-900"}`}
          >
            {seg.blocked ? "blocked" : "open"}
          </button>
          <button
            type="button"
            onClick={() =>
              patch(
                (d) =>
                  (d.segments[gi] = {
                    ...d.segments[gi],
                    bookMyShowOnly: !d.segments[gi].bookMyShowOnly,
                  })
              )
            }
            title={
              seg.bookMyShowOnly
                ? "Reserved for BookMyShow — click to release"
                : "Click to reserve this block for the BookMyShow channel"
            }
            className={`text-sm px-1 rounded ${seg.bookMyShowOnly ? "font-semibold text-black" : "text-slate-700 hover:text-slate-900"}`}
          >
            {seg.bookMyShowOnly ? "BMS only" : "BMS"}
          </button>
          {row.segments.length > 1 && (
            <button
              type="button"
              onClick={() => patch((d) => d.segments.splice(gi, 1))}
              aria-label="Remove block"
              className="text-slate-700 hover:text-red-700"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={() => patch((d) => d.segments.push({ count: 5 }))}
        className="text-slate-800 hover:text-slate-900"
        aria-label="Add seat block"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>

      <span className="ml-auto text-[12px] text-slate-800 tabular-nums">{rowSeats} seats</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove row"
        className="text-slate-700 hover:text-red-700"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

/** Next A, B, … Z, then AA, AB … for a section's rows. */
function nextRowLabel(rows: LayoutRow[]): string {
  const used = new Set(rows.map((r) => r.label));
  for (let i = 0; i < 26; i++) {
    const c = String.fromCharCode(65 + i);
    if (!used.has(c)) return c;
  }
  return `R${rows.length + 1}`;
}
