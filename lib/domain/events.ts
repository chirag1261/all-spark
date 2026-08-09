import { MAX_GALLERY_PHOTOS, MAX_TOTAL_ROWS } from "@/constants";
import {
  EventItem,
  EventLandingContent,
  EventLayout,
  LandingDetail,
  LandingScheduleItem,
  LandingStat,
  LandingWhyCard,
  LayoutRow,
  LayoutSection,
  Seat,
  SeatSegment,
  SeatTier,
  TicketCategory,
} from "@/types";

import { VenueTier, buildVenue } from "./venue";

/** Flat seat list for an event (layout- or categories-derived). */
export function getSeatLayout(event: EventItem): Seat[] {
  return buildVenue(event).seats;
}

/** Seats actually on sale (physical capacity minus blocked). Use this for
 *  availability MATH (remaining = totalSeats() - booked - locked). */
export function totalSeats(event: EventItem): number {
  return buildVenue(event).sellable;
}

/** Every physical seat in the venue, including admin-blocked ones. Use this
 *  for the "of N" DISPLAY total shown to customers — blocked seats are still
 *  part of the venue, so the "remaining" count (which already subtracts them
 *  via totalSeats()) is what conveys their unavailability, not a shrunken
 *  total. */
export function totalPhysicalSeats(event: EventItem): number {
  return buildVenue(event).seats.length;
}

/** Price bands for display (deduped by price), premium first. */
export function ticketTiers(event: EventItem): VenueTier[] {
  return buildVenue(event).tiers;
}

/** Cheapest sellable seat price, or 0 if the event has none. */
export function minPrice(event: EventItem): number {
  const tiers = buildVenue(event).tiers;
  return tiers.length ? Math.min(...tiers.map((t) => t.price)) : 0;
}

/** Every seat id currently off-sale (layout blocking + ad-hoc holds). */
export function blockedSeatIds(event: EventItem): string[] {
  return buildVenue(event)
    .seats.filter((s) => s.blocked)
    .map((s) => s.id);
}

export function isValidSeatId(event: EventItem, seatId: string): boolean {
  return buildVenue(event).index.has(seatId);
}

export function seatPrice(event: EventItem, seatId: string): number | undefined {
  return buildVenue(event).index.get(seatId)?.price;
}

/** Whole days from now until the given instant (0 once it has passed). */
export function daysUntil(iso: string, now = Date.now()): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - now) / (24 * 60 * 60 * 1000)));
}

export type RegistrationState = "upcoming" | "open" | "closed";

/** Bookings are allowed only inside the registration window and before the event starts. */
export function registrationState(event: EventItem, now = Date.now()): RegistrationState {
  if (now < new Date(event.registrationOpensAt).getTime()) return "upcoming";
  const closes = Math.min(
    new Date(event.registrationClosesAt).getTime(),
    new Date(event.startsAt).getTime()
  );
  return now >= closes ? "closed" : "open";
}

export interface RefundEligibility {
  /** false once the event is under 48 hours away — no refund can be requested. */
  allowed: boolean;
  /** Fraction of the ticket amount refundable: 0.7 (>7 days out, 30% cancellation charge),
   *  0.5 (7 days–48h out, 50% charge), 0 (inside 48h, blocked). */
  fraction: 0.7 | 0.5 | 0;
}

/**
 * Customer-initiated cancellation refund policy (see Refund & Cancellation
 * Policy): more than 7 days before the event, a 30% cancellation charge
 * applies (70% refunded); from 7 days down to 48 hours before, a 50%
 * cancellation charge applies; inside the final 48 hours, refunds are
 * blocked entirely.
 */
export function refundEligibility(startsAtIso: string, now = Date.now()): RefundEligibility {
  const hoursUntil = (new Date(startsAtIso).getTime() - now) / (60 * 60 * 1000);
  if (hoursUntil < 48) return { allowed: false, fraction: 0 };
  if (hoursUntil < 24 * 7) return { allowed: true, fraction: 0.5 };
  return { allowed: true, fraction: 0.7 };
}

/**
 * Google Drive share links aren't direct image URLs — rewrite them to the
 * direct-download form. Cloudinary and other direct URLs pass through as-is.
 */
export function normalizeImageUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return "";
  const drive =
    /drive\.google\.com\/file\/d\/([\w-]+)/.exec(trimmed) ??
    /drive\.google\.com\/open\?id=([\w-]+)/.exec(trimmed);
  if (drive) return `https://drive.google.com/uc?export=view&id=${drive[1]}`;
  return trimmed;
}

export interface EventInput {
  title?: unknown;
  description?: unknown;
  venue?: unknown;
  city?: unknown;
  startsAt?: unknown;
  registrationOpensAt?: unknown;
  registrationClosesAt?: unknown;
  imageUrl?: unknown;
  tagline?: unknown;
  gallery?: unknown;
  featured?: unknown;
  poster?: unknown;
  faqs?: unknown;
  categories?: unknown;
  layout?: unknown;
  blockedSeats?: unknown;
  bookMyShowUrl?: unknown;
  landing?: unknown;
  published?: unknown;
}

const MAX_LAYOUT_SEATS = 6000;

/** Validates a rich seating layout. Returns the sanitized layout or a human error. */
export function validateLayout(
  raw: unknown
): { ok: true; value: EventLayout } | { ok: false; error: string } {
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  if (typeof raw !== "object" || raw === null) return { ok: false, error: "Layout is invalid" };
  const sectionsRaw = (raw as { sections?: unknown }).sections;
  if (!Array.isArray(sectionsRaw) || sectionsRaw.length === 0) {
    return { ok: false, error: "Add at least one seating section" };
  }
  if (sectionsRaw.length > 6) return { ok: false, error: "At most 6 sections are supported" };

  const sections: LayoutSection[] = [];
  const seenSectionIds = new Set<string>();
  let seatTotal = 0;

  for (const sRaw of sectionsRaw as Array<Record<string, unknown>>) {
    const name = str(sRaw?.name);
    if (!name) return { ok: false, error: "Every section needs a name" };
    const id = (str(sRaw?.id) || name)
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 8);
    if (!id) return { ok: false, error: `Section "${name}" needs a code (letters/digits)` };
    if (seenSectionIds.has(id)) return { ok: false, error: `Duplicate section code "${id}"` };
    seenSectionIds.add(id);

    const tiersRaw = sRaw?.tiers;
    if (!Array.isArray(tiersRaw) || tiersRaw.length === 0) {
      return { ok: false, error: `Section "${name}" needs at least one price tier` };
    }
    const tiers: SeatTier[] = [];
    const tierIds = new Set<string>();
    for (const tRaw of tiersRaw as Array<Record<string, unknown>>) {
      const tName = str(tRaw?.name);
      const price = Number(tRaw?.price);
      if (!tName) return { ok: false, error: `Section "${name}": every tier needs a name` };
      if (!Number.isInteger(price) || price <= 0) {
        return { ok: false, error: `Tier "${tName}": price must be a positive amount in paise` };
      }
      const tId = str(tRaw?.id) || `t_${tiers.length + 1}`;
      tiers.push({ id: tId, name: tName, price });
      tierIds.add(tId);
    }

    const rowsRaw = sRaw?.rows;
    if (!Array.isArray(rowsRaw) || rowsRaw.length === 0) {
      return { ok: false, error: `Section "${name}" needs at least one row` };
    }
    if (rowsRaw.length > 60)
      return { ok: false, error: `Section "${name}": too many rows (max 60)` };
    const rows: LayoutRow[] = [];
    const seenLabels = new Set<string>();
    for (const rRaw of rowsRaw as Array<Record<string, unknown>>) {
      const label = str(rRaw?.label).toUpperCase().slice(0, 3);
      if (!label) return { ok: false, error: `Section "${name}": every row needs a label` };
      if (seenLabels.has(label)) {
        return { ok: false, error: `Section "${name}": duplicate row label "${label}"` };
      }
      seenLabels.add(label);
      const tierId = str(rRaw?.tierId);
      if (!tierIds.has(tierId)) {
        return { ok: false, error: `Row "${label}": pick a valid price tier` };
      }
      const segsRaw = rRaw?.segments;
      if (!Array.isArray(segsRaw) || segsRaw.length === 0) {
        return { ok: false, error: `Row "${label}" needs at least one seat block` };
      }
      const segments: SeatSegment[] = [];
      for (const segRaw of segsRaw as Array<Record<string, unknown>>) {
        const count = Number(segRaw?.count);
        if (!Number.isInteger(count) || count < 1 || count > 120) {
          return { ok: false, error: `Row "${label}": each block must have 1–120 seats` };
        }
        const sideRaw = str(segRaw?.side).toUpperCase();
        const side = sideRaw === "L" || sideRaw === "R" ? (sideRaw as "L" | "R") : undefined;
        segments.push({
          count,
          ...(side ? { side } : {}),
          ...(segRaw?.blocked ? { blocked: true } : {}),
          // Must be carried through: this sanitizer rebuilds every row/segment
          // from scratch, so any field not explicitly copied here is silently
          // dropped on save. Omitting it made the admin's "BMS" reservation
          // toggle appear to work and then revert on reload.
          ...(segRaw?.bookMyShowOnly ? { bookMyShowOnly: true } : {}),
        });
        seatTotal += count;
      }
      rows.push({
        label,
        tierId,
        ...(rRaw?.blocked ? { blocked: true } : {}),
        ...(rRaw?.bookMyShowOnly ? { bookMyShowOnly: true } : {}),
        segments,
      });
    }
    sections.push({ id, name, tiers, rows });
  }

  if (seatTotal === 0) return { ok: false, error: "The layout has no seats" };
  if (seatTotal > MAX_LAYOUT_SEATS) {
    return { ok: false, error: `Layout exceeds the ${MAX_LAYOUT_SEATS}-seat limit` };
  }
  return { ok: true, value: { sections } };
}

/**
 * Sanitizes the optional rich landing-page content. Lenient (mirrors faqs):
 * bad rows are dropped rather than rejected, so a half-filled section never
 * blocks a save. Returns null when nothing meaningful was provided.
 */
export function sanitizeLanding(raw: unknown): EventLandingContent | null {
  if (typeof raw !== "object" || raw === null) return null;
  const src = raw as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const rows = (v: unknown): Record<string, unknown>[] =>
    Array.isArray(v) ? (v as Record<string, unknown>[]) : [];

  const presenter = str(src.presenter);
  const heroKicker = str(src.heroKicker);

  const whyAttend: LandingWhyCard[] = [];
  for (const r of rows(src.whyAttend).slice(0, 6)) {
    const title = str(r.title);
    const body = str(r.body);
    if (title || body) whyAttend.push({ title, body });
  }

  const details: LandingDetail[] = [];
  for (const r of rows(src.details).slice(0, 12)) {
    const label = str(r.label);
    const value = str(r.value);
    if (label || value) details.push({ label, value });
  }

  const schedule: LandingScheduleItem[] = [];
  for (const r of rows(src.schedule).slice(0, 24)) {
    const time = str(r.time);
    const title = str(r.title);
    const description = str(r.description);
    if (time || title || description) schedule.push({ time, title, description });
  }

  let artist: EventLandingContent["artist"] = null;
  if (src.artist && typeof src.artist === "object") {
    const a = src.artist as Record<string, unknown>;
    const name = str(a.name);
    const stats: LandingStat[] = [];
    for (const r of rows(a.stats).slice(0, 6)) {
      const value = str(r.value);
      const label = str(r.label);
      if (value || label) stats.push({ value, label });
    }
    if (name || str(a.bio) || str(a.imageUrl)) {
      artist = {
        name,
        title: str(a.title),
        bio: str(a.bio),
        imageUrl: normalizeImageUrl(str(a.imageUrl)),
        stats,
      };
    }
  }

  let venue: EventLandingContent["venue"] = null;
  if (src.venue && typeof src.venue === "object") {
    const v = src.venue as Record<string, unknown>;
    const name = str(v.name);
    if (name || str(v.address) || str(v.description)) {
      venue = {
        name,
        address: str(v.address),
        description: str(v.description),
        accessibility: str(v.accessibility),
        imageUrl: normalizeImageUrl(str(v.imageUrl)),
      };
    }
  }

  const hasContent =
    presenter ||
    heroKicker ||
    whyAttend.length ||
    details.length ||
    schedule.length ||
    artist ||
    venue;
  if (!hasContent) return null;

  return {
    ...(presenter ? { presenter } : {}),
    ...(heroKicker ? { heroKicker } : {}),
    ...(whyAttend.length ? { whyAttend } : {}),
    ...(details.length ? { details } : {}),
    ...(schedule.length ? { schedule } : {}),
    artist,
    venue,
  };
}

// Deep blue-family gradients — used as the featured-event hero backdrop
// behind a photo + legibility scrim with white text, so they stay rich/dark
// while keeping the site's cobalt identity.
const POSTERS = [
  "from-blue-700 via-indigo-800 to-slate-900",
  "from-sky-600 via-blue-800 to-slate-900",
  "from-indigo-600 via-blue-800 to-slate-950",
  "from-cyan-600 via-blue-800 to-slate-900",
  "from-violet-600 via-indigo-800 to-slate-900",
];

export function posterForIndex(i: number): string {
  return POSTERS[i % POSTERS.length];
}

/** Validates admin input for create/update. Returns the sanitized fields or a human error. */
export function validateEventInput(
  body: EventInput
):
  | { ok: true; value: Omit<EventItem, "id" | "createdAt" | "updatedAt" | "poster"> }
  | { ok: false; error: string } {
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const title = str(body.title);
  const description = str(body.description);
  const venue = str(body.venue);
  const city = str(body.city);

  if (!title) return { ok: false, error: "Title is required" };
  if (!venue) return { ok: false, error: "Venue is required" };

  const dates = {
    startsAt: str(body.startsAt),
    registrationOpensAt: str(body.registrationOpensAt),
    registrationClosesAt: str(body.registrationClosesAt),
  };
  for (const [field, value] of Object.entries(dates)) {
    if (!value || Number.isNaN(new Date(value).getTime())) {
      return { ok: false, error: `${field} must be a valid date/time` };
    }
  }
  if (new Date(dates.registrationOpensAt) >= new Date(dates.registrationClosesAt)) {
    return { ok: false, error: "Registration must open before it closes" };
  }

  // Rich layout supersedes categories when supplied; otherwise the legacy
  // uniform-grid categories model is required.
  const hasLayout =
    body.layout != null &&
    typeof body.layout === "object" &&
    Array.isArray((body.layout as { sections?: unknown }).sections) &&
    (body.layout as { sections: unknown[] }).sections.length > 0;

  let layout: EventLayout | null = null;
  const categories: TicketCategory[] = [];

  if (hasLayout) {
    const parsed = validateLayout(body.layout);
    if (!parsed.ok) return parsed;
    layout = parsed.value;
  } else {
    if (!Array.isArray(body.categories) || body.categories.length === 0) {
      return { ok: false, error: "At least one ticket category is required" };
    }
    let totalRows = 0;
    for (const raw of body.categories as Array<Record<string, unknown>>) {
      const name = str(raw?.name);
      const price = Number(raw?.price);
      const rows = Number(raw?.rows);
      const seatsPerRow = Number(raw?.seatsPerRow);
      if (!name) return { ok: false, error: "Every ticket category needs a name" };
      if (!Number.isInteger(price) || price <= 0) {
        return { ok: false, error: `Category "${name}": price must be a positive amount in paise` };
      }
      if (!Number.isInteger(rows) || rows < 1 || rows > MAX_TOTAL_ROWS) {
        return {
          ok: false,
          error: `Category "${name}": rows must be between 1 and ${MAX_TOTAL_ROWS}`,
        };
      }
      if (!Number.isInteger(seatsPerRow) || seatsPerRow < 1 || seatsPerRow > 40) {
        return { ok: false, error: `Category "${name}": seats per row must be between 1 and 40` };
      }
      totalRows += rows;
      categories.push({
        id: str(raw?.id) || `cat_${categories.length + 1}`,
        name,
        price,
        rows,
        seatsPerRow,
      });
    }
    if (totalRows > MAX_TOTAL_ROWS) {
      return { ok: false, error: `Total rows across categories cannot exceed ${MAX_TOTAL_ROWS}` };
    }
  }

  const faqs: EventItem["faqs"] = [];
  if (body.faqs !== undefined) {
    if (!Array.isArray(body.faqs)) return { ok: false, error: "faqs must be an array" };
    for (const raw of body.faqs as Array<Record<string, unknown>>) {
      const question = str(raw?.question);
      const answer = str(raw?.answer);
      if (question && answer) faqs.push({ question, answer });
    }
  }

  // Blocked seats must exist in the layout defined by the categories above.
  const blockedSeats: string[] = [];
  if (body.blockedSeats !== undefined) {
    if (!Array.isArray(body.blockedSeats)) {
      return { ok: false, error: "blockedSeats must be an array" };
    }
    const layoutProbe = { categories, layout, blockedSeats: [] } as unknown as EventItem;
    for (const raw of body.blockedSeats) {
      const seatId = str(raw).toUpperCase();
      if (!seatId) continue;
      if (!isValidSeatId(layoutProbe, seatId)) {
        return { ok: false, error: `Blocked seat "${seatId}" is not in the seat layout` };
      }
      if (!blockedSeats.includes(seatId)) blockedSeats.push(seatId);
    }
  }

  const gallery: string[] = [];
  if (body.gallery !== undefined) {
    if (!Array.isArray(body.gallery)) return { ok: false, error: "gallery must be an array" };
    for (const raw of body.gallery) {
      const url = normalizeImageUrl(str(raw));
      if (url) gallery.push(url);
    }
    if (gallery.length > MAX_GALLERY_PHOTOS) {
      return { ok: false, error: `Gallery is limited to ${MAX_GALLERY_PHOTOS} photos` };
    }
  }

  // Optional external BookMyShow listing — must be a valid http(s) URL.
  let bookMyShowUrl: string | null = null;
  const bmsRaw = str(body.bookMyShowUrl);
  if (bmsRaw) {
    try {
      const parsed = new URL(bmsRaw);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return { ok: false, error: "BookMyShow link must be an http(s) URL" };
      }
      bookMyShowUrl = parsed.toString();
    } catch {
      return { ok: false, error: "BookMyShow link is not a valid URL" };
    }
  }

  return {
    ok: true,
    value: {
      title,
      description,
      venue,
      city,
      ...dates,
      imageUrl: normalizeImageUrl(str(body.imageUrl)),
      tagline: str(body.tagline),
      gallery,
      featured: Boolean(body.featured),
      faqs,
      categories,
      layout,
      blockedSeats,
      bookMyShowUrl,
      landing: sanitizeLanding(body.landing),
      published: Boolean(body.published),
    },
  };
}
