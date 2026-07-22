import { Pool } from "pg";

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
  return new Pool({
    connectionString,
    ssl: useSsl ? { rejectUnauthorized: false } : undefined,
  });
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

  ALTER TABLE bookings ADD COLUMN IF NOT EXISTS customer_id TEXT;
  ALTER TABLE bookings ADD COLUMN IF NOT EXISTS attendees JSONB NOT NULL DEFAULT '[]';
  CREATE INDEX IF NOT EXISTS bookings_customer_id_idx ON bookings (customer_id);
`;

async function ensureSchema(): Promise<void> {
  await pool().query(SCHEMA);
}

/** Runs the schema bootstrap exactly once per process, memoizing the promise. */
export async function ready(): Promise<void> {
  if (!g.__pgReady) g.__pgReady = ensureSchema();
  await g.__pgReady;
}

export function db(): Pool {
  return pool();
}
