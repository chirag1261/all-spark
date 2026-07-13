# BookMyShow Clone — Next.js + Razorpay

A single-page movie-ticket booking app modeled on BookMyShow: browse movies → pick a showtime → select seats → pay via Razorpay → get a booking confirmation.

## Stack

- **Next.js 16** (App Router) · React 19 · TypeScript · Tailwind CSS 4
- **Razorpay** Checkout.js on the client, `razorpay` Node SDK on the server
- In-memory store for seat locks & bookings (stand-in for a DB + Redis)

## Setup

1. Get **test-mode** API keys from the [Razorpay dashboard](https://dashboard.razorpay.com/app/website-app-settings/api-keys) (they start with `rzp_test_`).
2. Put them in `.env.local`:

   ```
   RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxxx
   RAZORPAY_KEY_SECRET=your_key_secret
   ```

3. *(Optional)* To email tickets, add SMTP credentials (see `.env.example` — for Gmail use an [App Password](https://myaccount.google.com/apppasswords)). Without SMTP the booking still completes and the ticket + QR are shown on screen.

4. Run:

   ```bash
   npm install
   npm run dev
   ```

5. Open http://localhost:3000. In test mode, pay with card `4111 1111 1111 1111`, any future expiry, any CVV, OTP `1234` — or use the "success"/"failure" test UPI IDs.

## Payment flow (what happens where)

```
Client                          Server                        Razorpay
  │  POST /api/orders             │                              │
  │  {showId, seatIds, email} ──▶ │ validate + LOCK seats (8m)   │
  │                               │ compute amount server-side   │
  │                               │ orders.create ─────────────▶ │
  │  ◀── {orderId, amount, keyId} │                              │
  │  Checkout.js opens ─────────────────────────────────────────▶│
  │  ◀────────────────── payment_id + signature (on success) ────│
  │  POST /api/verify ──────────▶ │ HMAC-SHA256 verify           │
  │                               │ seats locked → BOOKED        │
  │  ◀── booking confirmed        │                              │
```

Key safety properties:

- **Amount is computed on the server** from seat tiers — the client never sends a price.
- **Signature verification** (`HMAC_SHA256(order_id|payment_id, key_secret)`, timing-safe compare) is the only thing that confirms a booking.
- **Seats are locked before payment** and released on failure/dismissal; locks expire after 8 minutes.
- **Verification is idempotent** — replaying a successful verify returns the same booking and the **same ticket**, without resending the email.
- **Unique ticket** (`TKT-XXXX-XXXX-XXXX`, crypto-random) with a QR code is generated on confirmation and emailed via SMTP; email failure never fails a paid booking — the ticket is always shown on screen.

## Endpoints

| Route | Method | Purpose |
|---|---|---|
| `/api/orders` | POST | Validate selection, lock seats, create Razorpay order |
| `/api/verify` | POST | Verify payment signature, confirm booking |
| `/api/release` | POST | Release locked seats when checkout is dismissed |
| `/api/seats` | GET | Booked + locked seats for a show |

## Known demo limitations

- The store is in-memory: bookings vanish on server restart, and it won't work across multiple server instances. Production needs a DB with transactions (or Redis `SET NX` locks) and Razorpay **webhooks** as the source of truth for payment success (the browser `handler` alone can be lost if the tab closes mid-payment).
- No auth — email is free-form.
- Shows/seat layouts are static mock data.

See [TESTCASES.md](./TESTCASES.md) for the full list of flow-breaking test cases.
