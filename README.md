# Utsav Events — Event Booking Platform (Next.js + Razorpay)

A multi-event booking platform with an admin dashboard: admins create events with ticket categories, registration windows, banners and FAQs; attendees pick seats on an interactive auditorium map, pay via Razorpay, and get a unique QR ticket by email + a WhatsApp-shareable ticket page.

## Features

- **Multi-event website** — event listing with search, event detail pages with banner (Cloudinary / Google Drive image links), FAQs, ticket pricing and live seats-remaining / sold-out badges.
- **Featured-event landing page** — mark one event as *Featured* in admin and the home page becomes a rich, responsive landing page for it: hero with banner + tagline + days-to-go, quick-facts strip, about section, photo gallery, ticket-category cards, FAQ accordion and booking CTAs. Everything on it is admin-controlled.
- **Admin dashboard** (`/admin`) — registrations, revenue and remaining-seats stats; create/edit/publish/delete events in a right-side drawer; configure ticket categories (name, price, rows, seats-per-row), registration open/close dates, taglines, banners, photo galleries and FAQs.
- **Multi-user admin accounts with roles & permissions** — a **Super Admin** role manages other admin accounts from `/admin/users`: create/edit/delete admins, reset passwords, and grant scoped **Events** / **Bookings** / **Refunds** permissions per account. Regular admins only see and can act on what they're granted; every admin API re-checks the permission server-side, not just the UI.
- **Cloudinary CDN images** — set the `CLOUDINARY_*` env vars and the admin panel gets direct image upload (signed server-side, the secret never leaves the server); images serve from Cloudinary's CDN. Without them, pasting Cloudinary/Google Drive URLs still works.
- **Interactive seat selection** — auditorium map generated from the event's ticket categories, real-time availability polling, seat locking (8-min TTL) with automatic release on failed/dismissed payments, sold-out handling.
- **Razorpay payments** — server-side amount computation, HMAC signature verification, success / failed / pending states and **admin-initiated full refunds** (frees the seats).
- **Customer accounts (OTP login)** — visitors sign up / sign in with an **email or phone number**: email OTPs go out via SMTP, phone OTPs via SMS (Twilio env vars; server-console delivery in dev). New users get a signup step; returning users choose **password or OTP**. Signed-in customers get **My Account, My Bookings, My Transactions, My Tickets, Contact Us and Logout** from the header menu. **Login is mandatory before purchase** — enforced server-side in `/api/orders`, not just in the UI — and booking contact details come from the verified profile, never free-form input.
- **Per-attendee tickets** — booking for more than one person requires each attendee's name (one per seat), and every attendee gets their **own individual QR ticket** with its own shareable `/ticket/[id]` page. All tickets are emailed together and live under My Tickets.
- **Booking management** — attendee search (name / email / phone / booking / ticket ID), event & status filters, **CSV export** for Excel/Sheets.

## Stack

- **Next.js 16** (App Router) · React 19 · TypeScript · Tailwind CSS 4
- **Razorpay** Checkout.js on the client, `razorpay` Node SDK on the server
- **PostgreSQL** for everything durable (events, bookings, booked seats, admin accounts, audit/payments logs) via the `pg` driver — no ORM, plain SQL, schema created automatically on first run. Seat *locks* (the temporary 8-minute hold while a buyer checks out) are intentionally kept in-memory, same role a Redis lock would play — they're a short-lived hold, not data that needs to survive a restart.

## Setup

1. **Postgres**: get a database and put its connection string in `.env.local` as `DATABASE_URL`. Any of these work:
   - **Local**: `brew install postgresql@16 && brew services start postgresql@16 && createdb utsavevents`, then `DATABASE_URL=postgres://localhost:5432/utsavevents`
   - **Hosted** (Neon, Supabase, Railway, RDS, etc.): paste the connection string they give you, and set `DATABASE_SSL=true` if it requires TLS (most hosted providers do).

   The schema (`events`, `bookings`, `booked_seats`, `admin_users`, `audit_log`, `payments_log`) is created automatically — `CREATE TABLE IF NOT EXISTS` runs on first request, no separate migration step. Three example events and a bootstrap Super Admin are seeded the first time the tables are empty.

2. Get **test-mode** API keys from the [Razorpay dashboard](https://dashboard.razorpay.com/app/website-app-settings/api-keys) (they start with `rzp_test_`).
3. Put them in `.env.local`, and set the bootstrap super admin's email/password (only used to create the *first* account — see [Admin accounts & roles](#admin-accounts--roles)):

   ```
   DATABASE_URL=postgres://localhost:5432/utsavevents
   RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxxx
   RAZORPAY_KEY_SECRET=your_key_secret
   ADMIN_EMAIL=utsavevents.tech@gmail.com
   ADMIN_PASSWORD=choose_a_password
   ```

4. *(Optional)* To email tickets, add SMTP credentials (see `.env.example` — for Gmail use an [App Password](https://myaccount.google.com/apppasswords)). Without SMTP the booking still completes and the ticket + QR are shown on screen.

4. Run:

   ```bash
   npm install
   npm run dev
   ```

5. Open http://localhost:3000 (the store seeds three sample events on first run). Admin lives at http://localhost:3000/admin. In test mode, pay with card `4111 1111 1111 1111`, any future expiry, any CVV, OTP `1234` — or use the "success"/"failure" test UPI IDs.

## Payment flow (what happens where)

```
Client                          Server                        Razorpay
  │  POST /api/orders             │                              │
  │  {eventId, seatIds,           │ validate + registration      │
  │   name, email, phone} ──────▶ │ window + LOCK seats (8m)     │
  │                               │ compute amount server-side   │
  │                               │ orders.create ─────────────▶ │
  │  ◀── {orderId, amount, keyId} │                              │
  │  Checkout.js opens ─────────────────────────────────────────▶│
  │  ◀────────────────── payment_id + signature (on success) ────│
  │  POST /api/verify ──────────▶ │ HMAC-SHA256 verify           │
  │                               │ seats locked → BOOKED        │
  │  ◀── ticket + QR + email      │                              │
```

Key safety properties:

- **Amount is computed on the server** from ticket categories — the client never sends a price.
- **Signature verification** (`HMAC_SHA256(order_id|payment_id, key_secret)`, timing-safe compare) is the only thing that confirms a booking.
- **Seats are locked before payment** and released on failure/dismissal; locks expire after 8 minutes.
- **Verification is idempotent** — replaying a successful verify returns the same booking and the **same ticket**, without resending the email.
- **Unique ticket** (`TKT-XXXX-XXXX-XXXX`, crypto-random) with a QR code is generated on confirmation and emailed via SMTP; email failure never fails a paid booking — the ticket is always shown on screen.
- **Admin sessions** are HMAC-signed HttpOnly cookies keyed to a user id; every admin API re-resolves the *live* user record on each request, so a permission change, role change, or account deletion takes effect immediately — not on next login.
- **Passwords** are hashed with scrypt (Node's built-in KDF, random salt per user) — plaintext is never stored, and login is rate-limited (8 attempts/min per client).
- **Refunds** go through the Razorpay refund API, mark the booking REFUNDED and return its seats to sale.
- **Webhook is the source of truth** — with `RAZORPAY_WEBHOOK_SECRET` set, `payment.captured` confirms bookings even when the buyer's tab closes mid-payment (and flags a conflict for manual refund if the seats were re-sold in the gap); `payment.failed` releases holds; `refund.processed` reconciles dashboard-initiated refunds. Every delivery is logged.
- **Audit trail** — every admin action touching money or bookings (event create/update/delete, refund, cancel) is recorded and shown on the dashboard.
- **Abuse controls** — order creation and booking lookups are rate-limited; releasing a seat hold requires the per-order token returned at order creation; admins can block seats (VIP/press holds) that then present as sold.
- **Reconciliation sweep** — PENDING bookings whose lock long expired are auto-marked FAILED so reports stay truthful.
- **OTP security** — 6 digits from `crypto.randomInt`; only an HMAC of the code is stored (a DB leak leaks no live codes); 5-minute expiry; single use; max 5 wrong attempts; issuing a new code invalidates old ones; codes are never present in any API response; dual rate limits (per client IP and per contact) on sending, plus limits on verifying and password logins.
- **Customer sessions** are a separate HttpOnly cookie from admin sessions (HMAC-signed, 30 days), re-resolved against the live customer record per request. Changing an existing password requires the current one, so a stolen session cookie can't take over the credentials.

## Admin accounts & roles

There are two roles:

- **Super Admin** — full access to everything, plus `/admin/users`: create, edit, reset passwords for, and delete other admin accounts, and grant/revoke their permissions.
- **Admin** — scoped to whichever of three permissions a super admin has granted: **Events** (create/edit/publish/delete events, upload images), **Bookings** (view/search bookings, export CSV, cancel pending ones), **Refunds** (issue refunds). An admin with no permissions can sign in but sees "Access denied" everywhere except the dashboard shell.

The **first** account is bootstrapped automatically from `ADMIN_EMAIL` / `ADMIN_PASSWORD` the first time the store initializes (as a Super Admin) — after that, those env vars are never read again; manage all accounts, including that one, from `/admin/users`. Safety rails: a super admin can't delete or demote their own account, and the system always keeps at least one super admin (the last one can't be deleted or demoted). Every account create/update/delete is written to the audit trail on the dashboard.

## Endpoints

| Route | Method | Purpose |
|---|---|---|
| `/api/orders` | POST | Validate selection + registration window, lock seats, create Razorpay order (rate-limited) |
| `/api/verify` | POST | Verify payment signature, confirm booking, email ticket (fast path) |
| `/api/webhooks/razorpay` | POST | **Authoritative** payment signal — signature-verified, idempotent; confirms captured payments even if the buyer's tab died, releases on failure, processes refunds |
| `/api/release` | POST | Release locked seats when checkout is dismissed (requires the per-order release token) |
| `/api/seats` | GET | Booked + locked (+ admin-blocked, shown as sold) seats for an event |
| `/api/bookings/lookup` | POST | Public booking-status check by booking ID + email |
| `/api/auth/start` | POST | Classify email/phone, report whether the account exists and its sign-in methods (rate-limited) |
| `/api/auth/otp/send` / `otp/verify` | POST | Issue / verify a 6-digit OTP; verify logs in (or creates the account with `name`) |
| `/api/auth/login` / `logout` / `me` | POST/GET | Customer password login, sign-out, current profile |
| `/api/account` / `account/password` | PUT/POST | Update profile name; set/change password (current password required to change) |
| `/api/admin/login` / `logout` | POST | Admin session cookie (email + password, rate-limited) |
| `/api/admin/me` | GET | Current admin's public profile (id, name, email, role, permissions) |
| `/api/admin/events` | GET/POST | List / create events — requires **events** permission |
| `/api/admin/events/[id]` | GET/PUT/DELETE | Read / update / delete an event — requires **events** permission (delete blocked while confirmed bookings exist; layout shrink blocked while it would orphan sold seats) |
| `/api/admin/bookings/export` | GET | CSV export of (filtered) bookings — requires **bookings** permission |
| `/api/admin/refund` | POST | Full refund of a confirmed booking — requires **refunds** permission (audited) |
| `/api/admin/cancel` | POST | Cancel a PENDING booking and free its held seats — requires **bookings** permission (audited) |
| `/api/admin/upload` | POST | Signed image upload to Cloudinary — requires **events** permission |
| `/api/admin/users` | GET/POST | List / create admin users — **super admin only** |
| `/api/admin/users/[id]` | GET/PUT/DELETE | Read / update (role, permissions, password reset) / delete an admin user — **super admin only**, guarded against self-deletion and removing the last super admin |

## Pages

| Route | Purpose |
|---|---|
| `/` | Featured-event landing page (falls back to the event grid when nothing is featured) |
| `/events/[id]` | Event detail: banner, description, FAQs, pricing, availability |
| `/events/[id]/book` | Seat map + per-seat attendee names + Razorpay checkout (**requires sign-in**) |
| `/ticket/[ticketId]` | Public shareable ticket — one attendee's QR per page |
| `/login` | Email/phone-first sign-in + signup wizard (OTP or password) |
| `/account`, `/account/bookings`, `/account/transactions`, `/account/tickets` | Customer account area |
| `/contact` | Contact Us |
| `/my-booking` | Booking-status lookup (booking ID + email) with ticket re-download |
| `/admin` | Dashboard: stats + event table (requires **events** permission); create/edit opens a right-side drawer |
| `/admin/bookings` | Booking management: search, filters, CSV, refunds (requires **bookings** permission; refund button additionally requires **refunds**) |
| `/admin/users` | Admin account management — **super admin only** |

## Known demo limitations

- Seat *locks* are in-memory: with more than one server instance, locks don't propagate across them, so two instances could both accept a hold on the same seat. Events/bookings/accounts themselves are safely shared via Postgres — only the lock step needs a shared store (Redis `SET NX`) to be fully correct across multiple instances. Razorpay **webhooks** are already wired up as the source of truth for payment success (see below), which is the other production-readiness item this kind of app usually needs.
- Attendee identity is unverified (no OTP/login) — email/phone are free-form.
- WhatsApp sharing uses `wa.me` share links; sending tickets *from* a business number needs the WhatsApp Business API.

See [TESTCASES.md](./TESTCASES.md) for the full list of flow-breaking test cases.
