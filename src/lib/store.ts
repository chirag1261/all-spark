import { Booking } from "./types";

/**
 * In-memory booking store (demo stand-in for a database + Redis locks).
 * Stored on globalThis so state survives Next.js dev-server hot reloads.
 *
 * Seat lifecycle: available -> locked (order created, 8 min TTL) -> booked (payment verified).
 * If payment fails or the lock expires, seats return to available.
 */

export const SEAT_LOCK_TTL_MS = 8 * 60 * 1000;

interface SeatLock {
  orderId: string;
  expiresAt: number;
}

interface StoreShape {
  // showId -> seatId -> lock
  locks: Map<string, Map<string, SeatLock>>;
  // showId -> Set of permanently booked seatIds
  booked: Map<string, Set<string>>;
  // razorpayOrderId -> booking
  bookings: Map<string, Booking>;
}

const g = globalThis as typeof globalThis & { __bmsStore?: StoreShape };

function store(): StoreShape {
  if (!g.__bmsStore) {
    g.__bmsStore = { locks: new Map(), booked: new Map(), bookings: new Map() };
  }
  return g.__bmsStore;
}

function liveLocks(showId: string): Map<string, SeatLock> {
  const s = store();
  let locks = s.locks.get(showId);
  if (!locks) {
    locks = new Map();
    s.locks.set(showId, locks);
  }
  // Purge expired locks lazily.
  const now = Date.now();
  for (const [seatId, lock] of locks) {
    if (lock.expiresAt <= now) locks.delete(seatId);
  }
  return locks;
}

export function getBookedSeats(showId: string): string[] {
  return [...(store().booked.get(showId) ?? [])];
}

export function getLockedSeats(showId: string): string[] {
  return [...liveLocks(showId).keys()];
}

/**
 * Atomically lock all requested seats for an order.
 * Fails (returns the conflicting seats) if ANY seat is already locked or booked —
 * partial locks are never left behind.
 */
export function lockSeats(
  showId: string,
  seatIds: string[],
  orderId: string
): { ok: true } | { ok: false; conflicts: string[] } {
  const locks = liveLocks(showId);
  const booked = store().booked.get(showId) ?? new Set();

  const conflicts = seatIds.filter((id) => locks.has(id) || booked.has(id));
  if (conflicts.length > 0) return { ok: false, conflicts };

  const expiresAt = Date.now() + SEAT_LOCK_TTL_MS;
  for (const id of seatIds) locks.set(id, { orderId, expiresAt });
  return { ok: true };
}

export function releaseSeats(showId: string, orderId: string): void {
  const locks = liveLocks(showId);
  for (const [seatId, lock] of locks) {
    if (lock.orderId === orderId) locks.delete(seatId);
  }
}

/** Promote an order's locked seats to permanently booked. */
export function confirmSeats(showId: string, seatIds: string[], orderId: string): void {
  releaseSeats(showId, orderId);
  let booked = store().booked.get(showId);
  if (!booked) {
    booked = new Set();
    store().booked.set(showId, booked);
  }
  for (const id of seatIds) booked.add(id);
}

export function saveBooking(booking: Booking): void {
  store().bookings.set(booking.razorpayOrderId, booking);
}

export function getBooking(orderId: string): Booking | undefined {
  return store().bookings.get(orderId);
}
