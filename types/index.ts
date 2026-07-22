/** A priced seating category, e.g. VIP / Gold / Silver. Rows are allocated
 *  to categories in order, so category order defines the auditorium layout.
 *  This is the LEGACY uniform-grid model — richer venues use `EventItem.layout`. */
export interface TicketCategory {
  id: string;
  name: string;
  price: number; // paise
  rows: number; // number of rows allocated to this category
  seatsPerRow: number;
}

// ---------- Rich venue layout (multi-floor, variable rows, side wings) ----------
//
// A layout supersedes `categories` when present, letting an event model a real
// auditorium exactly: several sections (floors), rows with per-row seat counts,
// aisle-split segments, left/right side wings, and price tiers + blocking at the
// section / row / segment level. Seat ids are section-namespaced so row letters
// can repeat across floors (e.g. lower "LWR-A1" vs balcony "BAL-A1").

/** A named price band within a section (paise). */
export interface SeatTier {
  id: string;
  name: string;
  price: number;
}

/** A contiguous run of seats in a row. Center segments share the row's running
 *  1..N numbering; side wings ("L"/"R") number independently (L1.., R1..). */
export interface SeatSegment {
  count: number;
  /** Left/right wing; omitted for the main center block. */
  side?: "L" | "R";
  /** Whole segment off-sale (e.g. the balcony side wings held back). */
  blocked?: boolean;
}

export interface LayoutRow {
  label: string; // "A".."Z", unique within its section
  tierId: string; // price tier for this row's seats
  blocked?: boolean; // entire row off-sale (e.g. front rows A/B)
  segments: SeatSegment[]; // ordered left → right
}

export interface LayoutSection {
  /** Uppercase alnum code, also the seat-id prefix (e.g. "LWR", "BAL"). */
  id: string;
  name: string; // "Lower Floor", "Balcony"
  tiers: SeatTier[];
  rows: LayoutRow[];
}

export interface EventLayout {
  sections: LayoutSection[];
}

export interface EventFaq {
  question: string;
  answer: string;
}

export interface EventItem {
  id: string;
  title: string;
  description: string;
  venue: string;
  city: string;
  startsAt: string; // ISO datetime
  registrationOpensAt: string; // ISO datetime — bookings allowed from here…
  registrationClosesAt: string; // ISO datetime — …until here (and never after startsAt)
  /** Banner image — a Cloudinary URL or a Google Drive share link (normalized on render). */
  imageUrl: string;
  /** Short one-liner shown under the title on the landing page hero. */
  tagline: string;
  /** Photo gallery for the landing page (Cloudinary/Drive URLs). */
  gallery: string[];
  /** At most one event is featured — it becomes the site's landing page. */
  featured: boolean;
  /** Tailwind gradient token used when no imageUrl is set. */
  poster: string;
  faqs: EventFaq[];
  categories: TicketCategory[];
  /** Rich seating layout. When present it supersedes `categories` for the seat
   *  map, pricing and capacity; `categories` stays as a legacy fallback. */
  layout?: EventLayout | null;
  /** Extra seats the admin has taken off sale ad-hoc (on top of any layout-level
   *  blocking). Shown as sold. */
  blockedSeats: string[];
  /** Optional external BookMyShow listing. When set, the public pages surface a
   *  "also on BookMyShow" option linking here. Admin-controlled. */
  bookMyShowUrl?: string | null;
  published: boolean;
  createdAt: number;
  updatedAt: number;
}

/** A single generated seat — the unit the seat map renders and bookings reference. */
export interface Seat {
  id: string; // legacy "A12", or section-namespaced "LWR-C23" / "BAL-AL1"
  sectionId: string; // "" for legacy events
  rowLabel: string;
  number: number;
  /** Left/right wing marker; omitted for center seats. */
  side?: "L" | "R";
  tierId: string;
  tierName: string;
  price: number; // paise
  blocked: boolean;
}

export type SeatState = "available" | "locked" | "booked";

export type BookingStatus = "PENDING" | "CONFIRMED" | "FAILED" | "REFUNDED";

/** Trail of admin actions that affect money or bookings. */
export interface AuditEntry {
  id: string;
  action: string; // e.g. "event.create", "booking.refund"
  entity: string; // "event" | "booking"
  entityId: string;
  detail: string; // human-readable summary
  at: number;
}

/** Record of every Razorpay webhook received (idempotency/debugging aid). */
export interface PaymentLogEntry {
  id: string;
  eventType: string;
  orderId?: string;
  paymentId?: string;
  outcome: string;
  at: number;
}

export type AdminRole = "super_admin" | "admin";

/** Scoped capabilities assignable to non-super-admin users. Super admins
 *  implicitly have all of them and can't be restricted. */
export type AdminPermission = "events" | "bookings" | "refunds";

export const ADMIN_PERMISSIONS: AdminPermission[] = ["events", "bookings", "refunds"];

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  /** scrypt-derived, stored as "saltHex:hashHex" — never the plaintext. */
  passwordHash: string;
  role: AdminRole;
  permissions: AdminPermission[]; // ignored for super_admin (implicitly all)
  createdAt: number;
  updatedAt: number;
  lastLoginAt?: number;
}

/** AdminUser minus the password hash — the only shape ever sent to the client. */
export type AdminUserPublic = Omit<AdminUser, "passwordHash">;

/** One person occupying one seat within a booking. */
export interface BookingAttendee {
  seatId: string;
  name: string;
}

export interface Booking {
  bookingId: string;
  eventId: string;
  /** The signed-in customer who paid (bookings are always customer-owned). */
  customerId?: string;
  seatIds: string[];
  /** Per-seat attendee details — each gets an individual QR ticket on confirmation. */
  attendees: BookingAttendee[];
  amount: number; // paise
  razorpayOrderId: string;
  razorpayPaymentId?: string;
  razorpayRefundId?: string;
  status: BookingStatus;
  attendeeName: string; // purchaser's name (from their profile)
  customerEmail: string; // verified profile email ("" for phone-only accounts)
  customerPhone: string; // verified profile phone ("" for email-only accounts)
  createdAt: number;
  ticketId?: string; // first ticket's id, kept for legacy links; see tickets table
  emailSent?: boolean;
}

/** An individual QR ticket — one per attendee/seat, minted on confirmation. */
export interface TicketRecord {
  ticketId: string;
  bookingId: string;
  eventId: string;
  seatId: string;
  attendeeName: string;
  createdAt: number;
}

// ---------- Customer accounts (public site users) ----------

export type OtpChannel = "email" | "phone";

export interface Customer {
  id: string;
  name: string;
  /** Lowercased email; null for phone-only accounts. */
  email: string | null;
  /** Normalized +<country><number>; null for email-only accounts. */
  phone: string | null;
  /** scrypt "salt:hash"; null until the customer sets a password (OTP-only). */
  passwordHash: string | null;
  emailVerified: boolean;
  phoneVerified: boolean;
  createdAt: number;
  updatedAt: number;
  lastLoginAt?: number;
}

export type CustomerPublic = Omit<Customer, "passwordHash">;

/** A pending OTP challenge. The code itself is never stored — only its hash. */
export interface OtpChallenge {
  id: string;
  identifier: string; // lowercased email or normalized phone
  channel: OtpChannel;
  codeHash: string;
  expiresAt: number;
  attempts: number;
  consumed: boolean;
  createdAt: number;
}
