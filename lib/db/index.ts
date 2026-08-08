import crypto from "crypto";
import type { PoolClient } from "pg";
import { cache } from "react";

import { SEAT_LOCK_TTL_MS } from "@/constants";
import { hashPassword } from "@/lib/auth/password";
import { blockedSeatIds, posterForIndex } from "@/lib/domain/events";
import { logger } from "@/lib/logger";
import { BABU_JAGAJEEVANRAM_LAYOUT } from "@/lib/domain/venues";
import {
  AdminUser,
  AuditEntry,
  Booking,
  Customer,
  EventItem,
  Organizer,
  OtpChallenge,
  PromoCode,
  TicketRecord,
} from "@/types";

import { db, ready } from "./pg";

/**
 * Postgres-backed store. Every exported function here is async and talks to
 * the `events` / `booked_seats` / `bookings` / `admin_users` / `audit_log` /
 * `payments_log` tables (schema + connection pool live in ./pg).
 *
 * Seat LOCKS remain in-memory (a Map on globalThis) — they're a short-lived
 * hold (8-minute TTL) analogous to a Redis lock, not data that needs to
 * survive a restart or be queryable, so there's no reason to put them in the
 * database. Everything else (events, bookings, confirmed seats, accounts,
 * logs) is durable in Postgres.
 *
 * Seat lifecycle: available -> locked (order created, 8 min TTL) -> booked
 * (payment verified). Failed payments and expired locks free the seats.
 */

interface SeatLock {
  orderId: string;
  expiresAt: number;
}

const g = globalThis as typeof globalThis & {
  __seatLocks?: Map<string, Map<string, SeatLock>>;
  __seedDone?: Promise<void>;
};

function locksByEvent(): Map<string, Map<string, SeatLock>> {
  if (!g.__seatLocks) g.__seatLocks = new Map();
  return g.__seatLocks;
}

async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await db().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    logger.db.error("Transaction rolled back", { err: String(err) });
    throw err;
  } finally {
    client.release();
  }
}

// ---------- Row <-> domain mapping ----------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToEvent(r: any): EventItem {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    venue: r.venue,
    city: r.city,
    startsAt: new Date(r.starts_at).toISOString(),
    registrationOpensAt: new Date(r.registration_opens_at).toISOString(),
    registrationClosesAt: new Date(r.registration_closes_at).toISOString(),
    imageUrl: r.image_url,
    tagline: r.tagline,
    gallery: r.gallery,
    featured: r.featured,
    poster: r.poster,
    faqs: r.faqs,
    categories: r.categories,
    layout: r.layout ?? null,
    blockedSeats: r.blocked_seats,
    bookMyShowUrl: r.bookmyshow_url ?? null,
    landing: r.landing ?? null,
    published: r.published,
    createdAt: Number(r.created_at),
    updatedAt: Number(r.updated_at),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToBooking(r: any): Booking {
  return {
    bookingId: r.booking_id,
    eventId: r.event_id,
    customerId: r.customer_id ?? undefined,
    seatIds: r.seat_ids,
    attendees: r.attendees ?? [],
    amount: r.amount,
    razorpayOrderId: r.razorpay_order_id,
    razorpayPaymentId: r.razorpay_payment_id ?? undefined,
    razorpayRefundId: r.razorpay_refund_id ?? undefined,
    status: r.status,
    attendeeName: r.attendee_name,
    customerEmail: r.customer_email,
    customerPhone: r.customer_phone,
    createdAt: Number(r.created_at),
    ticketId: r.ticket_id ?? undefined,
    emailSent: r.email_sent ?? undefined,
    whatsappSent: r.whatsapp_sent ?? undefined,
    promoCode: r.promo_code ?? undefined,
    discountAmount: r.discount_amount ?? undefined,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToAdminUser(r: any): AdminUser {
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    phone: r.phone ?? null,
    passwordHash: r.password_hash,
    role: r.role,
    permissions: r.permissions,
    // Backfill: rows created before the column existed default to active.
    active: r.active == null ? true : Boolean(r.active),
    createdAt: Number(r.created_at),
    updatedAt: Number(r.updated_at),
    lastLoginAt: r.last_login_at != null ? Number(r.last_login_at) : undefined,
  };
}

// ---------- Seed data (first run only) ----------

function seedEventSpecs() {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  // Free-license Unsplash CDN images (verified reachable) so the site looks
  // real out of the box — admins replace them with their own uploads.
  const img = (id: string, w = 1600) =>
    `https://images.unsplash.com/photo-${id}?w=${w}&q=80&auto=format&fit=crop`;

  const seeds = [
    {
      title: "Sunburn Arena: EDM Night",
      tagline: "One night. Three headliners. A wall of sound and light.",
      featured: true,
      imageUrl: img("1470229722913-7c0e2dbbafd3"),
      gallery: [
        img("1459749411175-04bf5292ceea", 1200),
        img("1501281668745-f7f57925c3b4", 1200),
        img("1492684223066-81342ee5ff30", 1200),
        img("1429962714451-bb934ecdc4ec", 1200),
        img("1516450360452-9312f5e86fc7", 1200),
      ],
      description:
        "An electrifying night of EDM with international headliners, immersive lighting and a festival-grade sound stage. Doors open 90 minutes before the show.",
      venue: "Phoenix Marketcity Arena",
      city: "Bengaluru",
      daysAway: 14,
      categories: [
        { id: "vip", name: "VIP Lounge", price: 250000, rows: 2, seatsPerRow: 10 },
        { id: "gold", name: "Gold", price: 150000, rows: 4, seatsPerRow: 14 },
        { id: "silver", name: "Silver", price: 80000, rows: 4, seatsPerRow: 14 },
      ],
      faqs: [
        {
          question: "Is there an age limit?",
          answer: "Entry is restricted to guests aged 16 and above. Carry a valid photo ID.",
        },
        {
          question: "Can I re-enter the venue?",
          answer: "No, re-entry is not permitted once you exit the arena.",
        },
      ],
    },
    {
      title: "Standup Comedy: Laugh Riot Live",
      tagline: "Three comics. Two hours. Zero mercy.",
      imageUrl: img("1478737270239-2f02b77fc618"),
      gallery: [img("1560439514-4e9645039924", 1200), img("1524368535928-5b5e00ddc76b", 1200)],
      description:
        "Three of India's top comics, one stage, two hours of non-stop laughter. Strictly 18+ show — expect strong language.",
      venue: "Good Shepherd Auditorium",
      city: "Bengaluru",
      daysAway: 7,
      categories: [
        { id: "premium", name: "Premium", price: 99900, rows: 3, seatsPerRow: 12 },
        { id: "regular", name: "Regular", price: 59900, rows: 5, seatsPerRow: 12 },
      ],
      faqs: [
        {
          question: "Is photography allowed?",
          answer:
            "No. Phones must stay in your pocket during the acts — recording leads to removal.",
        },
      ],
    },
    {
      title: "DevConf India 2026",
      tagline: "AI, systems and the web platform — one day, three tracks.",
      imageUrl: img("1540575467063-178a50c2df87"),
      gallery: [img("1475721027785-f74eccf877e2", 1200), img("1505373877841-8d25f7d46678", 1200)],
      description:
        "A full-day developer conference on AI engineering, distributed systems and web platform performance, with hands-on workshop tracks and networking lounges.",
      venue: "NIMHANS Convention Centre",
      city: "Bengaluru",
      daysAway: 30,
      categories: [
        { id: "workshop", name: "Conference + Workshop", price: 349900, rows: 2, seatsPerRow: 8 },
        { id: "conference", name: "Conference", price: 199900, rows: 6, seatsPerRow: 12 },
      ],
      faqs: [
        {
          question: "Are meals included?",
          answer: "Yes — lunch and two coffee breaks are included with every ticket.",
        },
        {
          question: "Will sessions be recorded?",
          answer: "Keynotes are recorded and shared with attendees; workshops are not.",
        },
      ],
    },
  ];

  return seeds.map((s, i) => {
    const startsAt = new Date(now + s.daysAway * day);
    startsAt.setHours(18, 30, 0, 0);
    const event: EventItem = {
      id: `evt_${crypto.randomBytes(6).toString("hex")}`,
      title: s.title,
      description: s.description,
      venue: s.venue,
      city: s.city,
      startsAt: startsAt.toISOString(),
      registrationOpensAt: new Date(now - day).toISOString(),
      registrationClosesAt: startsAt.toISOString(),
      imageUrl: s.imageUrl ?? "",
      tagline: s.tagline ?? "",
      gallery: s.gallery ?? [],
      featured: s.featured ?? false,
      poster: posterForIndex(i),
      faqs: s.faqs,
      categories: s.categories,
      blockedSeats: [],
      published: true,
      createdAt: now,
      updatedAt: now,
    };
    return event;
  });
}

/**
 * Bootstraps the first Super Admin from ADMIN_EMAIL/ADMIN_PASSWORD so there's
 * always a way in before any users exist in the store. Once at least one
 * admin user has been created, these env vars are no longer consulted —
 * account management moves entirely into /admin/users.
 */
function seedAdminUserSpec(): AdminUser | null {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return null;
  const now = Date.now();
  return {
    id: `usr_${crypto.randomBytes(6).toString("hex")}`,
    name: "Super Admin",
    email: (process.env.ADMIN_EMAIL || "utsavevents.tech@gmail.com").toLowerCase(),
    passwordHash: hashPassword(password),
    role: "super_admin",
    permissions: [],
    active: true,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Ensures the real Dr. Babu Jagajeevanram Bhavan Auditorium event exists as the
 * featured (landing-page) event. Idempotent and insert-only — keyed on a fixed
 * id, so it appears on existing installs without ever clobbering admin edits.
 * imageUrl is left empty on purpose so the landing hero pulls from the gallery.
 */
async function seedFeaturedVenueIfAbsent(): Promise<void> {
  const id = "evt_babu_auditorium";
  const { rows } = await db().query("SELECT 1 FROM events WHERE id = $1", [id]);
  if (rows.length) return;

  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  // Rudrotsav — 16 August 2026, 6:30 PM IST (12:00 UTC ~ 18:00 IST; set 13:00 UTC = 18:30 IST).
  const startsAt = new Date("2026-08-16T13:00:00.000Z");

  const event: EventItem = {
    id,
    title: "Rudrotsav",
    description:
      "Experience the divine resonance of bhajans as the legendary Gajendra Pratap Singh fills the evening with soul-stirring melodies. A gathering of hearts united in devotion.\n\nGajendra Pratap Singh — Renowned Bhajan Singer, whose voice carries decades of bhakti tradition.",
    venue: "Dr. Babu Jagjivanram Bhavan",
    city: "Bangalore",
    startsAt: startsAt.toISOString(),
    registrationOpensAt: new Date(now - day).toISOString(),
    registrationClosesAt: startsAt.toISOString(),
    imageUrl:
      "https://res.cloudinary.com/cih7cika/image/upload/f_auto,q_auto,w_1920/utsav-events/hero",
    tagline: "A Divine Bhajan Evening",
    gallery: [
      "https://res.cloudinary.com/cih7cika/image/upload/f_auto,q_auto,w_1920/utsav-events/hero",
      "https://res.cloudinary.com/cih7cika/image/upload/f_auto,q_auto,w_1600/utsav-events/artist",
      "https://res.cloudinary.com/cih7cika/image/upload/f_auto,q_auto,w_1600/utsav-events/audience",
    ],
    featured: true,
    poster: posterForIndex(0),
    faqs: [
      {
        question: "Who is performing?",
        answer:
          "Gajendra Pratap Singh, a renowned Bhajan singer whose voice carries decades of bhakti tradition — each bhajan a prayer, each note a blessing.",
      },
      {
        question: "How is seating arranged?",
        answer:
          "Choose your exact seat on the interactive map. Premium (₹2500) is closest to the stage, then Standard (₹1500) and Economy (₹1000). Balcony seating is also available.",
      },
      {
        question: "Are the balcony side seats available?",
        answer:
          "The left and right balcony wings are held back for now — only the main blocks are on sale.",
      },
    ],
    categories: [],
    layout: BABU_JAGAJEEVANRAM_LAYOUT,
    blockedSeats: [],
    // Placeholder — admin should replace with the real BookMyShow listing URL.
    bookMyShowUrl: "https://in.bookmyshow.com/",
    landing: {
      presenter: "Utsav Events Presents",
      heroKicker: "An Evening of Sacred Devotion",
      whyAttend: [
        {
          title: "A Master of Devotion",
          body: "Gajendra Pratap Singh's voice carries decades of bhakti tradition — each bhajan a prayer, each note a blessing that resonates long after the evening ends.",
        },
        {
          title: "A Sacred Gathering",
          body: "Join thousands of devotees in a shared moment of spiritual connection. Rudrotsav is not just a concert — it is a community coming together in reverence and joy.",
        },
        {
          title: "An Unforgettable Evening",
          body: "From the fragrance of flowers to the warmth of diyas, every detail of Rudrotsav is crafted to transport you into a world of divine celebration.",
        },
      ],
      artist: {
        name: "Gajendra Pratap Singh",
        title: "Renowned Bhajan Singer",
        bio: "Gajendra Pratap Singh is one of India's most beloved bhajan singers, known for his soul-stirring renditions of devotional compositions that span centuries of tradition. With a voice that effortlessly moves between tender intimacy and soaring power, he has performed at temples, sabhas, and cultural gatherings across India and abroad.\n\nHis repertoire draws from the rich traditions of Mirabai, Tulsidas, Surdas, and Kabir — bringing ancient poetry to life with a warmth and authenticity that resonates deeply with audiences of all ages. A performance by Gajendra Pratap Singh is not merely a concert; it is a spiritual experience.",
        imageUrl:
          "https://res.cloudinary.com/cih7cika/image/upload/f_auto,q_auto,w_1200/utsav-events/artist",
        stats: [
          { value: "25+ Years", label: "of devotional music" },
          { value: "500+ Concerts", label: "across India & abroad" },
          { value: "Beloved Voice", label: "of bhakti tradition" },
        ],
      },
      details: [
        { label: "Date", value: "Sunday, 16th August 2026" },
        { label: "Time", value: "6:30 PM onwards (Doors open at 6:00 PM)" },
        { label: "Venue", value: "Dr. Babu Jagjivanram Bhavan" },
        { label: "Address", value: "Bangalore" },
        { label: "Entry", value: "By registration only. Seats are limited." },
        { label: "Dress Code", value: "Traditional attire encouraged" },
      ],
      schedule: [
        { time: "6:00 PM", title: "Doors Open", description: "Welcome and seating" },
        {
          time: "6:30 PM",
          title: "Inaugural Prayers",
          description: "Invocation and lamp lighting ceremony",
        },
        {
          time: "7:00 PM",
          title: "Bhajan Sandhya Begins",
          description: "Gajendra Pratap Singh takes the stage",
        },
        { time: "9:30 PM", title: "Intermission", description: "Prasad distribution" },
        { time: "10:00 PM", title: "Second Session", description: "Continued bhajan recital" },
        { time: "11:00 PM", title: "Closing Aarti", description: "Collective aarti and blessings" },
      ],
      venue: {
        name: "Dr. Babu Jagjivanram Bhavan",
        address: "Millers Road, Vasanth Nagar, Bangalore",
        description:
          "A premier cultural auditorium in the heart of Bangalore, Dr. Babu Jagjivanram Bhavan has hosted some of the city's most celebrated cultural and devotional events. With excellent acoustics and a warm, welcoming atmosphere, it is the perfect setting for an evening of sacred music.",
        accessibility:
          "Easily accessible by metro (Cubbon Park station) and road. Ample parking available nearby.",
        imageUrl:
          "https://res.cloudinary.com/cih7cika/image/upload/f_auto,q_auto,w_1200/utsav-events/audience",
      },
    },
    published: true,
    createdAt: now,
    updatedAt: now,
  };

  await withTransaction(async (client) => {
    await insertEventRow(event, client);
    await enforceSingleFeatured(client, id);
  });
}

/**
 * Seeds example events / the bootstrap admin exactly once, only if those tables
 * are empty. The demo events (Sunburn Arena, Standup Comedy, DevConf) are meant
 * to make a fresh dev database look real out of the box — set
 * SEED_DEMO_EVENTS=false on production deploys so a first-run prod database
 * only ever gets the real venue seed (seedFeaturedVenueIfAbsent), not these.
 */
async function seedIfEmpty(): Promise<void> {
  const pool = db();
  if (process.env.SEED_DEMO_EVENTS !== "false") {
    const { rows: eventCountRows } = await pool.query("SELECT COUNT(*)::int AS n FROM events");
    if (eventCountRows[0].n === 0) {
      for (const event of seedEventSpecs()) {
        await insertEventRow(event);
      }
    }
  }

  const { rows: userCountRows } = await pool.query("SELECT COUNT(*)::int AS n FROM admin_users");
  if (userCountRows[0].n === 0) {
    const admin = seedAdminUserSpec();
    if (admin) await insertAdminUserRow(admin);
  }
}

async function initOnce(): Promise<void> {
  if (!g.__seedDone) {
    g.__seedDone = ready().then(seedIfEmpty).then(seedFeaturedVenueIfAbsent);
  }
  await g.__seedDone;
}

// ---------- Events ----------

async function insertEventRow(event: EventItem, client?: PoolClient): Promise<void> {
  await (client ?? db()).query(
    `INSERT INTO events (
      id, title, description, venue, city, starts_at, registration_opens_at,
      registration_closes_at, image_url, tagline, gallery, featured, poster,
      faqs, categories, layout, blocked_seats, bookmyshow_url, landing, published, created_at, updated_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)`,
    [
      event.id,
      event.title,
      event.description,
      event.venue,
      event.city,
      event.startsAt,
      event.registrationOpensAt,
      event.registrationClosesAt,
      event.imageUrl,
      event.tagline,
      JSON.stringify(event.gallery),
      event.featured,
      event.poster,
      JSON.stringify(event.faqs),
      JSON.stringify(event.categories),
      event.layout ? JSON.stringify(event.layout) : null,
      JSON.stringify(event.blockedSeats),
      event.bookMyShowUrl ?? null,
      event.landing ? JSON.stringify(event.landing) : null,
      event.published,
      event.createdAt,
      event.updatedAt,
    ]
  );
}

/** At most one event may be featured — featuring one un-features the rest. */
async function enforceSingleFeatured(client: PoolClient, featuredId: string): Promise<void> {
  await client.query("UPDATE events SET featured = false WHERE id != $1 AND featured = true", [
    featuredId,
  ]);
}

export async function listEvents(): Promise<EventItem[]> {
  await initOnce();
  const { rows } = await db().query("SELECT * FROM events ORDER BY starts_at ASC");
  return rows.map(rowToEvent);
}

export async function listPublishedEvents(): Promise<EventItem[]> {
  const events = await listEvents();
  return events.filter((e) => e.published);
}

/**
 * The single featured (landing-page) published event, if any. Wrapped in
 * React's cache() so the several call sites that need this per page render
 * (SiteHeader plus the page itself on About/Contact) share one DB round trip
 * per request instead of querying it twice.
 */
export const getFeaturedEvent = cache(async (): Promise<EventItem | undefined> => {
  await initOnce();
  const { rows } = await db().query(
    "SELECT * FROM events WHERE featured = true AND published = true LIMIT 1"
  );
  return rows[0] ? rowToEvent(rows[0]) : undefined;
});

export async function getEvent(id: string): Promise<EventItem | undefined> {
  await initOnce();
  const { rows } = await db().query("SELECT * FROM events WHERE id = $1", [id]);
  return rows[0] ? rowToEvent(rows[0]) : undefined;
}

export async function createEvent(event: EventItem): Promise<void> {
  await initOnce();
  await withTransaction(async (client) => {
    await insertEventRow(event, client);
    if (event.featured) await enforceSingleFeatured(client, event.id);
  });
}

export async function updateEvent(
  id: string,
  patch: Partial<EventItem>
): Promise<EventItem | undefined> {
  await initOnce();
  return withTransaction(async (client) => {
    const { rows } = await client.query("SELECT * FROM events WHERE id = $1 FOR UPDATE", [id]);
    if (!rows[0]) return undefined;
    const merged: EventItem = { ...rowToEvent(rows[0]), ...patch, id, updatedAt: Date.now() };

    await client.query(
      `UPDATE events SET
        title=$2, description=$3, venue=$4, city=$5, starts_at=$6,
        registration_opens_at=$7, registration_closes_at=$8, image_url=$9,
        tagline=$10, gallery=$11, featured=$12, poster=$13, faqs=$14,
        categories=$15, layout=$16, blocked_seats=$17, bookmyshow_url=$18,
        landing=$19, published=$20, updated_at=$21
      WHERE id=$1`,
      [
        id,
        merged.title,
        merged.description,
        merged.venue,
        merged.city,
        merged.startsAt,
        merged.registrationOpensAt,
        merged.registrationClosesAt,
        merged.imageUrl,
        merged.tagline,
        JSON.stringify(merged.gallery),
        merged.featured,
        merged.poster,
        JSON.stringify(merged.faqs),
        JSON.stringify(merged.categories),
        merged.layout ? JSON.stringify(merged.layout) : null,
        JSON.stringify(merged.blockedSeats),
        merged.bookMyShowUrl ?? null,
        merged.landing ? JSON.stringify(merged.landing) : null,
        merged.published,
        merged.updatedAt,
      ]
    );
    if (merged.featured) await enforceSingleFeatured(client, id);
    return merged;
  });
}

export async function deleteEvent(
  id: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  await initOnce();
  const { rows } = await db().query(
    "SELECT 1 FROM bookings WHERE event_id = $1 AND status = 'CONFIRMED' LIMIT 1",
    [id]
  );
  if (rows.length > 0) {
    return { ok: false, error: "Event has confirmed bookings — unpublish it instead of deleting" };
  }
  await withTransaction(async (client) => {
    await client.query("DELETE FROM booked_seats WHERE event_id = $1", [id]);
    await client.query("DELETE FROM events WHERE id = $1", [id]);
  });
  return { ok: true };
}

// ---------- Seat availability ----------

function liveLocks(eventId: string): Map<string, SeatLock> {
  const all = locksByEvent();
  let locks = all.get(eventId);
  if (!locks) {
    locks = new Map();
    all.set(eventId, locks);
  }
  // Purge expired locks lazily.
  const now = Date.now();
  for (const [seatId, lock] of locks) {
    if (lock.expiresAt <= now) locks.delete(seatId);
  }
  return locks;
}

export async function getBookedSeats(eventId: string): Promise<string[]> {
  await initOnce();
  const { rows } = await db().query("SELECT seat_id FROM booked_seats WHERE event_id = $1", [
    eventId,
  ]);
  return rows.map((r) => r.seat_id);
}

/**
 * Booked-seat counts for every event in ONE query. Use this for list/grid views
 * instead of calling getBookedSeats() per event in a loop — a single aggregate
 * round-trip instead of N sequential ones (the difference is seconds against a
 * remote database).
 */
export async function getBookedSeatCounts(): Promise<Record<string, number>> {
  await initOnce();
  const { rows } = await db().query(
    "SELECT event_id, COUNT(*)::int AS n FROM booked_seats GROUP BY event_id"
  );
  const counts: Record<string, number> = {};
  for (const r of rows) counts[r.event_id] = r.n;
  return counts;
}

export async function getLockedSeats(eventId: string): Promise<string[]> {
  return [...liveLocks(eventId).keys()];
}

/**
 * Locked-seat counts for every event at once — mirrors getBookedSeatCounts(),
 * but reads the in-memory hold map instead of the DB (cheap, synchronous
 * under the hood). List/grid views must subtract BOTH booked and locked
 * seats from capacity: a seat someone else is mid-checkout on isn't actually
 * bookable right now even though it's not in `booked_seats` yet, and
 * disagreeing with that (showing it as "available" in a stat while the
 * live seat map correctly disables it) is exactly the kind of mismatch this
 * exists to prevent.
 */
export async function getLockedSeatCounts(): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const [eventId, locks] of locksByEvent()) {
    liveLocks(eventId); // mutates `locks` in place, purging its expired entries
    if (locks.size > 0) counts[eventId] = locks.size;
    else locksByEvent().delete(eventId); // drop now-empty per-event maps
  }
  return counts;
}

/**
 * Atomically lock all requested seats for an order.
 * Fails (returns the conflicting seats) if ANY seat is already locked, booked
 * or admin-blocked — partial locks are never left behind.
 */
export async function lockSeats(
  eventId: string,
  seatIds: string[],
  orderId: string
): Promise<{ ok: true } | { ok: false; conflicts: string[] }> {
  const locks = liveLocks(eventId);
  const [booked, event] = await Promise.all([getBookedSeats(eventId), getEvent(eventId)]);
  const bookedSet = new Set(booked);
  const blockedSet = new Set(event ? blockedSeatIds(event) : []);

  // A seat already held by THIS SAME order is not a conflict — lockSeats is
  // idempotent per-order (e.g. the webhook re-asserting a hold it already
  // has right before confirming). Only a different order's lock counts.
  const conflicts = seatIds.filter((id) => {
    const existing = locks.get(id);
    const lockedByOther = existing !== undefined && existing.orderId !== orderId;
    return lockedByOther || bookedSet.has(id) || blockedSet.has(id);
  });
  if (conflicts.length > 0) return { ok: false, conflicts };

  const expiresAt = Date.now() + SEAT_LOCK_TTL_MS;
  for (const id of seatIds) locks.set(id, { orderId, expiresAt });
  return { ok: true };
}

export async function releaseSeats(eventId: string, orderId: string): Promise<void> {
  const locks = liveLocks(eventId);
  for (const [seatId, lock] of locks) {
    if (lock.orderId === orderId) locks.delete(seatId);
  }
}

/** Promote an order's locked seats to permanently booked. */
export async function confirmSeats(
  eventId: string,
  seatIds: string[],
  orderId: string
): Promise<void> {
  await releaseSeats(eventId, orderId);
  if (seatIds.length === 0) return;
  const values = seatIds.map((_, i) => `($1, $${i + 2})`).join(",");
  await db().query(
    `INSERT INTO booked_seats (event_id, seat_id) VALUES ${values} ON CONFLICT DO NOTHING`,
    [eventId, ...seatIds]
  );
}

/** Free previously booked seats (refunds). */
export async function unbookSeats(eventId: string, seatIds: string[]): Promise<void> {
  if (seatIds.length === 0) return;
  await db().query("DELETE FROM booked_seats WHERE event_id = $1 AND seat_id = ANY($2::text[])", [
    eventId,
    seatIds,
  ]);
}

// ---------- Bookings ----------

export async function saveBooking(booking: Booking): Promise<void> {
  await initOnce();
  await db().query(
    `INSERT INTO bookings (
      booking_id, event_id, customer_id, seat_ids, attendees, amount,
      razorpay_order_id, razorpay_payment_id, razorpay_refund_id, status,
      attendee_name, customer_email, customer_phone, created_at, ticket_id, email_sent,
      promo_code, discount_amount, whatsapp_sent
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
    ON CONFLICT (razorpay_order_id) DO UPDATE SET
      booking_id = EXCLUDED.booking_id,
      event_id = EXCLUDED.event_id,
      customer_id = EXCLUDED.customer_id,
      seat_ids = EXCLUDED.seat_ids,
      attendees = EXCLUDED.attendees,
      amount = EXCLUDED.amount,
      razorpay_payment_id = EXCLUDED.razorpay_payment_id,
      razorpay_refund_id = EXCLUDED.razorpay_refund_id,
      status = EXCLUDED.status,
      attendee_name = EXCLUDED.attendee_name,
      customer_email = EXCLUDED.customer_email,
      customer_phone = EXCLUDED.customer_phone,
      ticket_id = EXCLUDED.ticket_id,
      email_sent = EXCLUDED.email_sent,
      promo_code = EXCLUDED.promo_code,
      discount_amount = EXCLUDED.discount_amount,
      whatsapp_sent = EXCLUDED.whatsapp_sent`,
    [
      booking.bookingId,
      booking.eventId,
      booking.customerId ?? null,
      JSON.stringify(booking.seatIds),
      JSON.stringify(booking.attendees),
      booking.amount,
      booking.razorpayOrderId,
      booking.razorpayPaymentId ?? null,
      booking.razorpayRefundId ?? null,
      booking.status,
      booking.attendeeName,
      booking.customerEmail,
      booking.customerPhone,
      booking.createdAt,
      booking.ticketId ?? null,
      booking.emailSent ?? null,
      booking.promoCode ?? null,
      booking.discountAmount ?? null,
      booking.whatsappSent ?? null,
    ]
  );
}

export async function getBooking(orderId: string): Promise<Booking | undefined> {
  await initOnce();
  const { rows } = await db().query("SELECT * FROM bookings WHERE razorpay_order_id = $1", [
    orderId,
  ]);
  return rows[0] ? rowToBooking(rows[0]) : undefined;
}

export async function getBookingByTicketId(ticketId: string): Promise<Booking | undefined> {
  await initOnce();
  const { rows } = await db().query("SELECT * FROM bookings WHERE ticket_id = $1", [ticketId]);
  return rows[0] ? rowToBooking(rows[0]) : undefined;
}

export async function getBookingByPaymentId(paymentId: string): Promise<Booking | undefined> {
  await initOnce();
  const { rows } = await db().query("SELECT * FROM bookings WHERE razorpay_payment_id = $1", [
    paymentId,
  ]);
  return rows[0] ? rowToBooking(rows[0]) : undefined;
}

export async function getBookingByBookingId(bookingId: string): Promise<Booking | undefined> {
  await initOnce();
  const { rows } = await db().query("SELECT * FROM bookings WHERE booking_id = $1", [bookingId]);
  return rows[0] ? rowToBooking(rows[0]) : undefined;
}

/**
 * Reconciliation sweep: PENDING bookings whose seat lock has long expired are
 * dead (checkout abandoned, or the payment never confirmed via handler nor
 * webhook) — mark them FAILED so reports and the admin table stay truthful.
 * Runs lazily from admin pages and the webhook route.
 */
export async function sweepStalePending(): Promise<number> {
  await initOnce();
  const cutoff = Date.now() - (SEAT_LOCK_TTL_MS + 2 * 60 * 1000);
  const { rows } = await db().query(
    `UPDATE bookings SET status = 'FAILED'
     WHERE status = 'PENDING' AND created_at < $1
     RETURNING event_id, razorpay_order_id`,
    [cutoff]
  );
  for (const row of rows) {
    await releaseSeats(row.event_id, row.razorpay_order_id);
  }
  return rows.length;
}

// ---------- Audit + payments logs ----------

export async function audit(
  action: string,
  entity: string,
  entityId: string,
  detail: string
): Promise<void> {
  await initOnce();
  await db().query(
    "INSERT INTO audit_log (id, action, entity, entity_id, detail, at) VALUES ($1,$2,$3,$4,$5,$6)",
    [`aud_${crypto.randomBytes(5).toString("hex")}`, action, entity, entityId, detail, Date.now()]
  );
}

export async function listAudit(limit = 20): Promise<AuditEntry[]> {
  await initOnce();
  const { rows } = await db().query("SELECT * FROM audit_log ORDER BY at DESC LIMIT $1", [limit]);
  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    entity: r.entity,
    entityId: r.entity_id,
    detail: r.detail,
    at: Number(r.at),
  }));
}

export async function logPaymentEvent(
  eventType: string,
  outcome: string,
  ids: { orderId?: string; paymentId?: string } = {}
): Promise<void> {
  await initOnce();
  await db().query(
    `INSERT INTO payments_log (id, event_type, order_id, payment_id, outcome, at)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [
      `pay_${crypto.randomBytes(5).toString("hex")}`,
      eventType,
      ids.orderId ?? null,
      ids.paymentId ?? null,
      outcome,
      Date.now(),
    ]
  );
}

// ---------- Admin users ----------

async function insertAdminUserRow(user: AdminUser, client?: PoolClient): Promise<void> {
  await (client ?? db()).query(
    `INSERT INTO admin_users (
      id, name, email, phone, password_hash, role, permissions,
      active, created_at, updated_at, last_login_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      user.id,
      user.name,
      user.email,
      user.phone ?? null,
      user.passwordHash,
      user.role,
      JSON.stringify(user.permissions),
      user.active ?? true,
      user.createdAt,
      user.updatedAt,
      user.lastLoginAt ?? null,
    ]
  );
}

export async function listAdminUsers(): Promise<AdminUser[]> {
  await initOnce();
  const { rows } = await db().query("SELECT * FROM admin_users ORDER BY created_at ASC");
  return rows.map(rowToAdminUser);
}

export async function getAdminUserById(id: string): Promise<AdminUser | undefined> {
  await initOnce();
  const { rows } = await db().query("SELECT * FROM admin_users WHERE id = $1", [id]);
  return rows[0] ? rowToAdminUser(rows[0]) : undefined;
}

export async function getAdminUserByEmail(email: string): Promise<AdminUser | undefined> {
  await initOnce();
  const { rows } = await db().query("SELECT * FROM admin_users WHERE lower(email) = lower($1)", [
    email,
  ]);
  return rows[0] ? rowToAdminUser(rows[0]) : undefined;
}

export async function countSuperAdmins(): Promise<number> {
  await initOnce();
  const { rows } = await db().query(
    "SELECT COUNT(*)::int AS n FROM admin_users WHERE role = 'super_admin'"
  );
  return rows[0].n;
}

export async function createAdminUser(user: AdminUser): Promise<void> {
  await initOnce();
  await insertAdminUserRow(user);
}

export async function updateAdminUser(
  id: string,
  patch: Partial<AdminUser>
): Promise<AdminUser | undefined> {
  await initOnce();
  const existing = await getAdminUserById(id);
  if (!existing) return undefined;
  const merged: AdminUser = { ...existing, ...patch, id, updatedAt: Date.now() };

  await db().query(
    `UPDATE admin_users SET
      name=$2, email=$3, phone=$4, password_hash=$5, role=$6, permissions=$7,
      active=$8, updated_at=$9, last_login_at=$10
     WHERE id=$1`,
    [
      id,
      merged.name,
      merged.email,
      merged.phone ?? null,
      merged.passwordHash,
      merged.role,
      JSON.stringify(merged.permissions),
      merged.active ?? true,
      merged.updatedAt,
      merged.lastLoginAt ?? null,
    ]
  );
  return merged;
}

/** Flip an admin account active/inactive without touching anything else. */
export async function setAdminUserActive(
  id: string,
  active: boolean
): Promise<AdminUser | undefined> {
  await initOnce();
  const { rows } = await db().query(
    "UPDATE admin_users SET active=$2, updated_at=$3 WHERE id=$1 RETURNING *",
    [id, active, Date.now()]
  );
  return rows[0] ? rowToAdminUser(rows[0]) : undefined;
}

/** Count active super admins — used to protect the last one from lockout. */
export async function countActiveSuperAdmins(): Promise<number> {
  await initOnce();
  const { rows } = await db().query(
    "SELECT COUNT(*)::int AS n FROM admin_users WHERE role = 'super_admin' AND active = true"
  );
  return rows[0].n;
}

export async function deleteAdminUser(id: string): Promise<void> {
  await initOnce();
  await db().query("DELETE FROM admin_users WHERE id = $1", [id]);
}

// ---------- Promo codes ----------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToPromoCode(r: any): PromoCode {
  return {
    id: r.id,
    code: r.code,
    discountType: r.discount_type,
    discountValue: r.discount_value,
    maxDiscount: r.max_discount ?? null,
    minOrderAmount: r.min_order_amount,
    eventId: r.event_id ?? null,
    maxRedemptions: r.max_redemptions ?? null,
    redemptionCount: r.redemption_count,
    validFrom: r.valid_from != null ? Number(r.valid_from) : null,
    validTo: r.valid_to != null ? Number(r.valid_to) : null,
    active: r.active,
    createdAt: Number(r.created_at),
    updatedAt: Number(r.updated_at),
  };
}

async function insertPromoCodeRow(promo: PromoCode, client?: PoolClient): Promise<void> {
  await (client ?? db()).query(
    `INSERT INTO promo_codes (
      id, code, discount_type, discount_value, max_discount, min_order_amount,
      event_id, max_redemptions, redemption_count, valid_from, valid_to, active,
      created_at, updated_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
    [
      promo.id,
      promo.code,
      promo.discountType,
      promo.discountValue,
      promo.maxDiscount ?? null,
      promo.minOrderAmount,
      promo.eventId ?? null,
      promo.maxRedemptions ?? null,
      promo.redemptionCount,
      promo.validFrom ?? null,
      promo.validTo ?? null,
      promo.active,
      promo.createdAt,
      promo.updatedAt,
    ]
  );
}

export async function listPromoCodes(): Promise<PromoCode[]> {
  await initOnce();
  const { rows } = await db().query("SELECT * FROM promo_codes ORDER BY created_at DESC");
  return rows.map(rowToPromoCode);
}

export async function getPromoCodeById(id: string): Promise<PromoCode | undefined> {
  await initOnce();
  const { rows } = await db().query("SELECT * FROM promo_codes WHERE id = $1", [id]);
  return rows[0] ? rowToPromoCode(rows[0]) : undefined;
}

/** Case-insensitive lookup (codes are stored uppercased). */
export async function getPromoCodeByCode(code: string): Promise<PromoCode | undefined> {
  await initOnce();
  const { rows } = await db().query("SELECT * FROM promo_codes WHERE code = $1", [
    code.trim().toUpperCase(),
  ]);
  return rows[0] ? rowToPromoCode(rows[0]) : undefined;
}

export async function createPromoCode(promo: PromoCode): Promise<void> {
  await initOnce();
  await insertPromoCodeRow(promo);
}

export async function updatePromoCode(
  id: string,
  patch: Partial<PromoCode>
): Promise<PromoCode | undefined> {
  await initOnce();
  const existing = await getPromoCodeById(id);
  if (!existing) return undefined;
  const merged: PromoCode = { ...existing, ...patch, id, updatedAt: Date.now() };
  await db().query(
    `UPDATE promo_codes SET
      code=$2, discount_type=$3, discount_value=$4, max_discount=$5, min_order_amount=$6,
      event_id=$7, max_redemptions=$8, valid_from=$9, valid_to=$10, active=$11, updated_at=$12
     WHERE id=$1`,
    [
      id,
      merged.code,
      merged.discountType,
      merged.discountValue,
      merged.maxDiscount ?? null,
      merged.minOrderAmount,
      merged.eventId ?? null,
      merged.maxRedemptions ?? null,
      merged.validFrom ?? null,
      merged.validTo ?? null,
      merged.active,
      merged.updatedAt,
    ]
  );
  return merged;
}

/** Flip a promo code active/inactive without touching anything else. */
export async function setPromoCodeActive(
  id: string,
  active: boolean
): Promise<PromoCode | undefined> {
  await initOnce();
  const { rows } = await db().query(
    "UPDATE promo_codes SET active=$2, updated_at=$3 WHERE id=$1 RETURNING *",
    [id, active, Date.now()]
  );
  return rows[0] ? rowToPromoCode(rows[0]) : undefined;
}

export async function deletePromoCode(id: string): Promise<void> {
  await initOnce();
  await db().query("DELETE FROM promo_codes WHERE id = $1", [id]);
}

/**
 * Atomically count one redemption against a code's cap. Called once per
 * confirmed payment (see /api/verify). Best-effort — a code deleted between
 * order and confirmation simply updates zero rows.
 */
export async function incrementPromoRedemption(code: string): Promise<void> {
  await initOnce();
  await db().query(
    "UPDATE promo_codes SET redemption_count = redemption_count + 1, updated_at = $2 WHERE code = $1",
    [code.trim().toUpperCase(), Date.now()]
  );
}

// ---------- Organizers ----------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToOrganizer(r: any): Organizer {
  return {
    id: r.id,
    name: r.name,
    role: r.role,
    bio: r.bio,
    photoUrl: r.photo_url,
    displayOrder: r.display_order,
    published: r.published,
    createdAt: Number(r.created_at),
    updatedAt: Number(r.updated_at),
  };
}

/** All organizers (any published state) — admin panel. Ordered for editing convenience. */
export async function listOrganizers(): Promise<Organizer[]> {
  await initOnce();
  const { rows } = await db().query(
    "SELECT * FROM organizers ORDER BY display_order ASC, created_at ASC"
  );
  return rows.map(rowToOrganizer);
}

/** Published organizers only, in display order — the public Organizers page. */
export async function listPublishedOrganizers(): Promise<Organizer[]> {
  await initOnce();
  const { rows } = await db().query(
    "SELECT * FROM organizers WHERE published = true ORDER BY display_order ASC, created_at ASC"
  );
  return rows.map(rowToOrganizer);
}

export async function getOrganizerById(id: string): Promise<Organizer | undefined> {
  await initOnce();
  const { rows } = await db().query("SELECT * FROM organizers WHERE id = $1", [id]);
  return rows[0] ? rowToOrganizer(rows[0]) : undefined;
}

export async function createOrganizer(organizer: Organizer): Promise<void> {
  await initOnce();
  await db().query(
    `INSERT INTO organizers (
      id, name, role, bio, photo_url, display_order, published, created_at, updated_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      organizer.id,
      organizer.name,
      organizer.role,
      organizer.bio,
      organizer.photoUrl,
      organizer.displayOrder,
      organizer.published,
      organizer.createdAt,
      organizer.updatedAt,
    ]
  );
}

export async function updateOrganizer(
  id: string,
  patch: Partial<Organizer>
): Promise<Organizer | undefined> {
  await initOnce();
  const existing = await getOrganizerById(id);
  if (!existing) return undefined;
  const merged: Organizer = { ...existing, ...patch, id, updatedAt: Date.now() };
  await db().query(
    `UPDATE organizers SET
      name=$2, role=$3, bio=$4, photo_url=$5, display_order=$6, published=$7, updated_at=$8
     WHERE id=$1`,
    [
      id,
      merged.name,
      merged.role,
      merged.bio,
      merged.photoUrl,
      merged.displayOrder,
      merged.published,
      merged.updatedAt,
    ]
  );
  return merged;
}

export async function deleteOrganizer(id: string): Promise<void> {
  await initOnce();
  await db().query("DELETE FROM organizers WHERE id = $1", [id]);
}

// ---------- Customers (public site accounts) ----------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToCustomer(r: any): Customer {
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    phone: r.phone,
    passwordHash: r.password_hash,
    emailVerified: r.email_verified,
    phoneVerified: r.phone_verified,
    createdAt: Number(r.created_at),
    updatedAt: Number(r.updated_at),
    lastLoginAt: r.last_login_at != null ? Number(r.last_login_at) : undefined,
  };
}

export async function getCustomerById(id: string): Promise<Customer | undefined> {
  await initOnce();
  const { rows } = await db().query("SELECT * FROM customers WHERE id = $1", [id]);
  return rows[0] ? rowToCustomer(rows[0]) : undefined;
}

/** Looks a customer up by lowercased email or normalized phone. */
export async function getCustomerByIdentifier(identifier: string): Promise<Customer | undefined> {
  await initOnce();
  const { rows } = await db().query(
    "SELECT * FROM customers WHERE email = $1 OR phone = $1 LIMIT 1",
    [identifier]
  );
  return rows[0] ? rowToCustomer(rows[0]) : undefined;
}

export async function createCustomer(customer: Customer): Promise<void> {
  await initOnce();
  await db().query(
    `INSERT INTO customers (
      id, name, email, phone, password_hash, email_verified, phone_verified,
      created_at, updated_at, last_login_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [
      customer.id,
      customer.name,
      customer.email,
      customer.phone,
      customer.passwordHash,
      customer.emailVerified,
      customer.phoneVerified,
      customer.createdAt,
      customer.updatedAt,
      customer.lastLoginAt ?? null,
    ]
  );
}

export async function updateCustomer(
  id: string,
  patch: Partial<Customer>
): Promise<Customer | undefined> {
  await initOnce();
  const existing = await getCustomerById(id);
  if (!existing) return undefined;
  const merged: Customer = { ...existing, ...patch, id, updatedAt: Date.now() };
  await db().query(
    `UPDATE customers SET
      name=$2, email=$3, phone=$4, password_hash=$5, email_verified=$6,
      phone_verified=$7, updated_at=$8, last_login_at=$9
     WHERE id=$1`,
    [
      id,
      merged.name,
      merged.email,
      merged.phone,
      merged.passwordHash,
      merged.emailVerified,
      merged.phoneVerified,
      merged.updatedAt,
      merged.lastLoginAt ?? null,
    ]
  );
  return merged;
}

// ---------- OTP challenges ----------

/** Invalidates any previous codes for the identifier and stores a new hashed one. */
export async function createOtpChallenge(challenge: OtpChallenge): Promise<void> {
  await initOnce();
  await db().query("UPDATE otp_codes SET consumed = true WHERE identifier = $1", [
    challenge.identifier,
  ]);
  await db().query(
    `INSERT INTO otp_codes (id, identifier, channel, code_hash, expires_at, attempts, consumed, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      challenge.id,
      challenge.identifier,
      challenge.channel,
      challenge.codeHash,
      challenge.expiresAt,
      challenge.attempts,
      challenge.consumed,
      challenge.createdAt,
    ]
  );
}

/** The single live (unconsumed, unexpired) challenge for an identifier, if any. */
export async function getLiveOtpChallenge(identifier: string): Promise<OtpChallenge | undefined> {
  await initOnce();
  const { rows } = await db().query(
    `SELECT * FROM otp_codes
     WHERE identifier = $1 AND consumed = false AND expires_at > $2
     ORDER BY created_at DESC LIMIT 1`,
    [identifier, Date.now()]
  );
  const r = rows[0];
  if (!r) return undefined;
  return {
    id: r.id,
    identifier: r.identifier,
    channel: r.channel,
    codeHash: r.code_hash,
    expiresAt: Number(r.expires_at),
    attempts: r.attempts,
    consumed: r.consumed,
    createdAt: Number(r.created_at),
  };
}

/** Atomically bumps the attempt counter; returns the new count. */
export async function bumpOtpAttempts(id: string): Promise<number> {
  const { rows } = await db().query(
    "UPDATE otp_codes SET attempts = attempts + 1 WHERE id = $1 RETURNING attempts",
    [id]
  );
  return rows[0]?.attempts ?? 99;
}

export async function consumeOtpChallenge(id: string): Promise<void> {
  await db().query("UPDATE otp_codes SET consumed = true WHERE id = $1", [id]);
}

// ---------- Per-attendee tickets ----------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToTicket(r: any): TicketRecord {
  return {
    ticketId: r.ticket_id,
    bookingId: r.booking_id,
    eventId: r.event_id,
    seatId: r.seat_id,
    attendeeName: r.attendee_name,
    createdAt: Number(r.created_at),
    scannedAt: r.scanned_at != null ? Number(r.scanned_at) : null,
    scannedBy: r.scanned_by ?? null,
    scannedByName: r.scanned_by_name ?? null,
  };
}

export async function createTickets(tickets: TicketRecord[]): Promise<void> {
  await initOnce();
  for (const t of tickets) {
    await db().query(
      `INSERT INTO tickets (ticket_id, booking_id, event_id, seat_id, attendee_name, created_at)
       VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (ticket_id) DO NOTHING`,
      [t.ticketId, t.bookingId, t.eventId, t.seatId, t.attendeeName, t.createdAt]
    );
  }
}

export async function getTicket(ticketId: string): Promise<TicketRecord | undefined> {
  await initOnce();
  const { rows } = await db().query("SELECT * FROM tickets WHERE ticket_id = $1", [ticketId]);
  return rows[0] ? rowToTicket(rows[0]) : undefined;
}

export async function listTicketsForBooking(bookingId: string): Promise<TicketRecord[]> {
  await initOnce();
  const { rows } = await db().query(
    "SELECT * FROM tickets WHERE booking_id = $1 ORDER BY seat_id ASC",
    [bookingId]
  );
  return rows.map(rowToTicket);
}

/**
 * Atomically mark a ticket as checked in at the gate. The `scanned_at IS NULL`
 * guard makes this a no-op on an already-scanned ticket even under a double-scan
 * race — returns the updated record on success, or `undefined` if it was already
 * scanned (or doesn't exist).
 */
export async function checkInTicket(
  ticketId: string,
  byId: string,
  byName: string
): Promise<TicketRecord | undefined> {
  await initOnce();
  const { rows } = await db().query(
    `UPDATE tickets SET scanned_at=$2, scanned_by=$3, scanned_by_name=$4
     WHERE ticket_id=$1 AND scanned_at IS NULL RETURNING *`,
    [ticketId, Date.now(), byId, byName]
  );
  return rows[0] ? rowToTicket(rows[0]) : undefined;
}

/**
 * Admin-initiated ownership transfer: rename the attendee on an already-issued
 * ticket WITHOUT touching the ticket id or QR signature, so the same physical
 * QR (already emailed/shared) keeps working — only the name it's checked in
 * under changes. Keeps the booking's own per-seat `attendees` entry in sync
 * so the ticket page, "my booking" lookup and admin views all agree.
 */
export async function renameTicketAttendee(
  ticketId: string,
  newName: string
): Promise<TicketRecord | undefined> {
  await initOnce();
  const { rows } = await db().query(
    "UPDATE tickets SET attendee_name = $2 WHERE ticket_id = $1 RETURNING *",
    [ticketId, newName]
  );
  const ticket = rows[0] ? rowToTicket(rows[0]) : undefined;
  if (!ticket) return undefined;

  const booking = await getBookingByBookingId(ticket.bookingId);
  if (booking) {
    const attendees = booking.attendees.map((a) =>
      a.seatId === ticket.seatId ? { ...a, name: newName } : a
    );
    await db().query("UPDATE bookings SET attendees = $2 WHERE booking_id = $1", [
      booking.bookingId,
      JSON.stringify(attendees),
    ]);
  }
  return ticket;
}

/** All tickets for an event (attendance list), newest-scanned surfaced first. */
export async function listTicketsForEvent(eventId: string): Promise<TicketRecord[]> {
  await initOnce();
  const { rows } = await db().query(
    "SELECT * FROM tickets WHERE event_id = $1 ORDER BY scanned_at DESC NULLS LAST, seat_id ASC",
    [eventId]
  );
  return rows.map(rowToTicket);
}

/** Sold (issued tickets) vs. checked-in counts for an event's live dashboard. */
export async function getAttendanceCounts(
  eventId: string
): Promise<{ sold: number; checkedIn: number }> {
  await initOnce();
  const { rows } = await db().query(
    `SELECT COUNT(*)::int AS sold,
            COUNT(scanned_at)::int AS checked_in
     FROM tickets WHERE event_id = $1`,
    [eventId]
  );
  return { sold: rows[0]?.sold ?? 0, checkedIn: rows[0]?.checked_in ?? 0 };
}

export async function listTicketsForCustomer(customerId: string): Promise<TicketRecord[]> {
  await initOnce();
  const { rows } = await db().query(
    `SELECT t.* FROM tickets t
     JOIN bookings b ON b.booking_id = t.booking_id
     WHERE b.customer_id = $1 AND b.status = 'CONFIRMED'
     ORDER BY t.created_at DESC, t.seat_id ASC`,
    [customerId]
  );
  return rows.map(rowToTicket);
}

/** Newest-first bookings for a customer's account pages. */
export async function listBookingsForCustomer(customerId: string): Promise<Booking[]> {
  await initOnce();
  const { rows } = await db().query(
    "SELECT * FROM bookings WHERE customer_id = $1 ORDER BY created_at DESC",
    [customerId]
  );
  return rows.map(rowToBooking);
}

/** Newest-first bookings, optionally filtered by event and a free-text attendee search. */
export async function listBookings(filter?: {
  eventId?: string;
  query?: string;
}): Promise<Booking[]> {
  await initOnce();
  const { rows } = filter?.eventId
    ? await db().query("SELECT * FROM bookings WHERE event_id = $1 ORDER BY created_at DESC", [
        filter.eventId,
      ])
    : await db().query("SELECT * FROM bookings ORDER BY created_at DESC");

  let bookings = rows.map(rowToBooking);
  const q = filter?.query?.trim().toLowerCase();
  if (q) {
    bookings = bookings.filter((b) =>
      [
        b.attendeeName,
        b.customerEmail,
        b.customerPhone,
        b.bookingId,
        b.ticketId ?? "",
        ...b.seatIds,
      ]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }
  return bookings;
}
