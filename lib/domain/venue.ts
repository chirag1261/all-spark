import { EventItem, EventLayout, Seat } from "@/types";

/**
 * The single source of truth for an event's seating. It expands either the rich
 * `event.layout` (multi-floor, variable rows, side wings, per-segment blocking)
 * or the legacy uniform `event.categories` grid into one flat, indexable seat
 * list plus a render-ready section/row/group tree. Everything downstream —
 * pricing, validation, capacity, the seat map — is derived from here so the two
 * models never drift.
 */

/** A price band aggregated for display (deduped by price across sections). */
export interface VenueTier {
  id: string;
  name: string;
  price: number; // paise
  seats: number; // sellable seats at this price
}

/** A contiguous run of seats rendered together; a gap is drawn between groups. */
export interface VenueGroup {
  side?: "L" | "R";
  seats: Seat[];
}

export interface VenueRow {
  label: string;
  tierName: string;
  price: number;
  blocked: boolean;
  groups: VenueGroup[];
}

export interface VenueSection {
  id: string;
  name: string;
  rows: VenueRow[];
}

export interface Venue {
  sections: VenueSection[];
  tiers: VenueTier[];
  seats: Seat[];
  index: Map<string, Seat>;
  /** Count of seats actually on sale (physical minus blocked). */
  sellable: number;
}

const cache = new WeakMap<EventItem, Venue>();

function rowLetter(index: number): string {
  return String.fromCharCode(65 + index);
}

function makeSeatId(sectionId: string, rowLabel: string, side: "L" | "R" | undefined, n: number) {
  const prefix = sectionId ? `${sectionId}-` : "";
  return side ? `${prefix}${rowLabel}${side}${n}` : `${prefix}${rowLabel}${n}`;
}

/** Assemble the flat + tree views once, memoized per event object. */
export function buildVenue(event: EventItem): Venue {
  const cached = cache.get(event);
  if (cached) return cached;
  const venue =
    event.layout && event.layout.sections?.length
      ? fromLayout(event.layout, event.blockedSeats ?? [])
      : fromCategories(event);
  cache.set(event, venue);
  return venue;
}

function finalize(sections: VenueSection[]): Venue {
  const seats: Seat[] = [];
  const index = new Map<string, Seat>();
  // First-appearance-ordered, price-deduped tiers for the pricing cards.
  const tierByPrice = new Map<number, VenueTier>();
  for (const section of sections) {
    for (const row of section.rows) {
      for (const group of row.groups) {
        for (const seat of group.seats) {
          seats.push(seat);
          index.set(seat.id, seat);
          if (!seat.blocked) {
            const t = tierByPrice.get(seat.price);
            if (t) t.seats += 1;
            else
              tierByPrice.set(seat.price, {
                id: seat.tierId,
                name: seat.tierName,
                price: seat.price,
                seats: 1,
              });
          }
        }
      }
    }
  }
  const sellable = seats.reduce((n, s) => n + (s.blocked ? 0 : 1), 0);
  return { sections, tiers: [...tierByPrice.values()], seats, index, sellable };
}

function fromLayout(layout: EventLayout, extraBlocked: string[]): Venue {
  const blockedSet = new Set(extraBlocked);
  const sections: VenueSection[] = layout.sections.map((section) => {
    const tierMap = new Map(section.tiers.map((t) => [t.id, t]));
    const rows: VenueRow[] = section.rows.map((row) => {
      const tier = tierMap.get(row.tierId) ?? { id: row.tierId, name: "", price: 0 };
      let center = 0; // running number shared across center segments
      const sideCounters: Record<"L" | "R", number> = { L: 0, R: 0 };
      const groups: VenueGroup[] = row.segments.map((seg) => {
        const seats: Seat[] = [];
        for (let i = 0; i < seg.count; i++) {
          const n = seg.side ? (sideCounters[seg.side] += 1) : (center += 1);
          const id = makeSeatId(section.id, row.label, seg.side, n);
          seats.push({
            id,
            sectionId: section.id,
            rowLabel: row.label,
            number: n,
            side: seg.side,
            tierId: tier.id,
            tierName: tier.name,
            price: tier.price,
            blocked: Boolean(row.blocked) || Boolean(seg.blocked) || blockedSet.has(id),
          });
        }
        return { side: seg.side, seats };
      });
      return {
        label: row.label,
        tierName: tier.name,
        price: tier.price,
        blocked: Boolean(row.blocked),
        groups,
      };
    });
    return { id: section.id, name: section.name, rows };
  });
  return finalize(sections);
}

/** Legacy uniform-grid model: categories → sequential lettered rows, mid aisle. */
function fromCategories(event: EventItem): Venue {
  const blockedSet = new Set(event.blockedSeats ?? []);
  const rows: VenueRow[] = [];
  let rowIndex = 0;
  for (const cat of event.categories ?? []) {
    for (let r = 0; r < cat.rows; r++) {
      const label = rowLetter(rowIndex++);
      const seats: Seat[] = [];
      for (let n = 1; n <= cat.seatsPerRow; n++) {
        const id = `${label}${n}`;
        seats.push({
          id,
          sectionId: "",
          rowLabel: label,
          number: n,
          tierId: cat.id,
          tierName: cat.name,
          price: cat.price,
          blocked: blockedSet.has(id),
        });
      }
      // Split into two groups at the midpoint so a center aisle renders.
      const mid = Math.ceil(seats.length / 2);
      rows.push({
        label,
        tierName: cat.name,
        price: cat.price,
        blocked: false,
        groups: [{ seats: seats.slice(0, mid) }, { seats: seats.slice(mid) }],
      });
    }
  }
  return finalize([{ id: "", name: "", rows }]);
}
