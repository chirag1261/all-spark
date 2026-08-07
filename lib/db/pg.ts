import { Pool, type QueryResult } from "pg";

import { logger } from "@/lib/logger";

/**
 * Shared Postgres connection pool + one-time schema bootstrap.
 *
 * Pooled on globalThis so dev-server hot reloads reuse the same pool instead
 * of leaking a new one per reload. Schema creation is idempotent
 * (CREATE TABLE IF NOT EXISTS) and runs lazily on first query, mirroring the
 * old file-store's "just works on first run" ergonomics — no separate
 * migration step needed for this demo-scale schema.
 */

const g = globalThis as typeof globalThis & { __pgPool?: Pool; __pgReady?: Promise<void> };

function createPool(): Pool {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    throw new Error(
      "DATABASE_URL is not set. Point it at a Postgres instance, e.g. " +
        "postgres://user:pass@localhost:5432/utsavevents — see .env.example."
    );
  }

  // TLS is governed by the explicit `ssl` option below. Hosted providers (Neon,
  // etc.) hand you a URL with `?sslmode=require`, which recent `pg` versions warn
  // about (they now alias require→verify-full). Strip it to silence that warning
  // while keeping SSL on whenever the URL asked for it or DATABASE_SSL=true.
  let connectionString = raw;
  let urlWantsSsl = false;
  try {
    const url = new URL(raw);
    const mode = url.searchParams.get("sslmode");
    urlWantsSsl = mode !== null && mode !== "disable";
    url.searchParams.delete("sslmode");
    connectionString = url.toString();
  } catch {
    /* not a parseable URL — use it verbatim */
  }

  const useSsl = process.env.DATABASE_SSL === "true" || urlWantsSsl;
  const p = new Pool({
    connectionString,
    ssl: useSsl ? { rejectUnauthorized: false } : undefined,
    keepAlive: true,
  });

  // Hosted/serverless Postgres (autosuspending compute, a proxy in front of the
  // DB, etc.) can silently kill a pooled connection while it sits idle. Without
  // a listener here that surfaces as an unhandled 'error' event on the pool —
  // at best a scary log, at worst a process crash — so always drain it.
  p.on("error", (err) => {
    logger.server.error("Postgres pool idle client error", { err: String(err) });
  });

  // The very next query over that now-dead connection still fails outright
  // ("Connection terminated unexpectedly") before the pool has replaced it.
  // Every call site in lib/db/index.ts goes through `db().query(...)`, so
  // wrapping it once here — retry a single time on a connection-loss error —
  // covers all of them without touching each call site. (Doesn't cover
  // transaction clients from `pool.connect()`; those are freshly checked out
  // and query immediately, so they aren't exposed to this specific staleness.)
  const rawQuery = p.query.bind(p);
  p.query = ((text: string, values?: unknown[]): Promise<QueryResult> => {
    return rawQuery(text, values as never[]).catch(async (err: unknown) => {
      if (!isConnectionLossError(err)) throw err;
      logger.server.error("Postgres query failed (connection lost) — retrying once", {
        err: String(err),
      });
      return rawQuery(text, values as never[]);
    });
  }) as Pool["query"];

  return p;
}

function isConnectionLossError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return (
    message.includes("Connection terminated") ||
    message.includes("terminating connection") ||
    message.includes("ECONNRESET") ||
    message.includes("Client has encountered a connection error")
  );
}

function pool(): Pool {
  if (!g.__pgPool) g.__pgPool = createPool();
  return g.__pgPool;
}

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    venue TEXT NOT NULL,
    city TEXT NOT NULL DEFAULT '',
    starts_at TIMESTAMPTZ NOT NULL,
    registration_opens_at TIMESTAMPTZ NOT NULL,
    registration_closes_at TIMESTAMPTZ NOT NULL,
    image_url TEXT NOT NULL DEFAULT '',
    tagline TEXT NOT NULL DEFAULT '',
    gallery JSONB NOT NULL DEFAULT '[]',
    featured BOOLEAN NOT NULL DEFAULT false,
    poster TEXT NOT NULL DEFAULT '',
    faqs JSONB NOT NULL DEFAULT '[]',
    categories JSONB NOT NULL DEFAULT '[]',
    layout JSONB,
    blocked_seats JSONB NOT NULL DEFAULT '[]',
    published BOOLEAN NOT NULL DEFAULT false,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
  );
  -- Added after initial release; backfills existing deployments.
  ALTER TABLE events ADD COLUMN IF NOT EXISTS layout JSONB;
  ALTER TABLE events ADD COLUMN IF NOT EXISTS bookmyshow_url TEXT;
  ALTER TABLE events ADD COLUMN IF NOT EXISTS landing JSONB;

  CREATE TABLE IF NOT EXISTS booked_seats (
    event_id TEXT NOT NULL,
    seat_id TEXT NOT NULL,
    PRIMARY KEY (event_id, seat_id)
  );

  CREATE TABLE IF NOT EXISTS bookings (
    booking_id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    seat_ids JSONB NOT NULL,
    amount INTEGER NOT NULL,
    razorpay_order_id TEXT NOT NULL UNIQUE,
    razorpay_payment_id TEXT,
    razorpay_refund_id TEXT,
    status TEXT NOT NULL,
    attendee_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    created_at BIGINT NOT NULL,
    ticket_id TEXT,
    email_sent BOOLEAN
  );
  CREATE INDEX IF NOT EXISTS bookings_event_id_idx ON bookings (event_id);
  CREATE INDEX IF NOT EXISTS bookings_ticket_id_idx ON bookings (ticket_id);
  CREATE INDEX IF NOT EXISTS bookings_payment_id_idx ON bookings (razorpay_payment_id);

  CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY,
    action TEXT NOT NULL,
    entity TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    detail TEXT NOT NULL,
    at BIGINT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS payments_log (
    id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    order_id TEXT,
    payment_id TEXT,
    outcome TEXT NOT NULL,
    at BIGINT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS admin_users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL,
    permissions JSONB NOT NULL DEFAULT '[]',
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    last_login_at BIGINT
  );
  -- Added after initial release; backfills existing deployments.
  ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS phone TEXT;
  ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;

  CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE,
    phone TEXT UNIQUE,
    password_hash TEXT,
    email_verified BOOLEAN NOT NULL DEFAULT false,
    phone_verified BOOLEAN NOT NULL DEFAULT false,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    last_login_at BIGINT
  );

  CREATE TABLE IF NOT EXISTS otp_codes (
    id TEXT PRIMARY KEY,
    identifier TEXT NOT NULL,
    channel TEXT NOT NULL,
    code_hash TEXT NOT NULL,
    expires_at BIGINT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    consumed BOOLEAN NOT NULL DEFAULT false,
    created_at BIGINT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS otp_codes_identifier_idx ON otp_codes (identifier);

  CREATE TABLE IF NOT EXISTS tickets (
    ticket_id TEXT PRIMARY KEY,
    booking_id TEXT NOT NULL,
    event_id TEXT NOT NULL,
    seat_id TEXT NOT NULL,
    attendee_name TEXT NOT NULL,
    created_at BIGINT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS tickets_booking_id_idx ON tickets (booking_id);
  -- Venue entry check-in, added after initial release.
  ALTER TABLE tickets ADD COLUMN IF NOT EXISTS scanned_at BIGINT;
  ALTER TABLE tickets ADD COLUMN IF NOT EXISTS scanned_by TEXT;
  ALTER TABLE tickets ADD COLUMN IF NOT EXISTS scanned_by_name TEXT;
  CREATE INDEX IF NOT EXISTS tickets_event_id_idx ON tickets (event_id);

  ALTER TABLE bookings ADD COLUMN IF NOT EXISTS customer_id TEXT;
  ALTER TABLE bookings ADD COLUMN IF NOT EXISTS attendees JSONB NOT NULL DEFAULT '[]';
  CREATE INDEX IF NOT EXISTS bookings_customer_id_idx ON bookings (customer_id);
  -- Applied promo code + rupee discount, added after initial release.
  ALTER TABLE bookings ADD COLUMN IF NOT EXISTS promo_code TEXT;
  ALTER TABLE bookings ADD COLUMN IF NOT EXISTS discount_amount INTEGER;
  -- WhatsApp ticket delivery, added after initial release.
  ALTER TABLE bookings ADD COLUMN IF NOT EXISTS whatsapp_sent BOOLEAN;

  CREATE TABLE IF NOT EXISTS promo_codes (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,          -- stored UPPERCASE
    discount_type TEXT NOT NULL,        -- 'flat' | 'percent'
    discount_value INTEGER NOT NULL,    -- paise (flat) | percent-points (percent)
    max_discount INTEGER,               -- paise cap for percent; null for flat
    min_order_amount INTEGER NOT NULL DEFAULT 0,
    event_id TEXT,                      -- null = all events
    max_redemptions INTEGER,            -- null = unlimited
    redemption_count INTEGER NOT NULL DEFAULT 0,
    valid_from BIGINT,
    valid_to BIGINT,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS promo_codes_code_idx ON promo_codes (code);

  CREATE TABLE IF NOT EXISTS organizers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT '',
    bio TEXT NOT NULL DEFAULT '',
    photo_url TEXT NOT NULL DEFAULT '',
    display_order INTEGER NOT NULL DEFAULT 0,
    published BOOLEAN NOT NULL DEFAULT true,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS organizers_display_order_idx ON organizers (display_order);
`;

async function ensureSchema(): Promise<void> {
  try {
    await pool().query(SCHEMA);
    logger.server.info("DB schema ready");
  } catch (err) {
    logger.server.error("DB schema bootstrap failed", { err: String(err) });
    throw err;
  }
}

/** Runs the schema bootstrap exactly once per process, memoizing the promise. */
export async function ready(): Promise<void> {
  if (!g.__pgReady) g.__pgReady = ensureSchema();
  await g.__pgReady;
}

export function db(): Pool {
  return pool();
}
