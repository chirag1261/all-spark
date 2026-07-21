# Flow-Breaking Test Cases

Every scenario that can break the browse → event → seats → pay → confirm flow, grouped by stage.
**Handled** = this repo defends against it. **Prod-gap** = needs real infra (DB/webhooks) to fully close.

## 1. Seat selection

| # | Test case | Expected behaviour | Status |
|---|---|---|---|
| 1.1 | Pay with zero seats selected | Button disabled; API rejects with 400 "Select at least one seat" | Handled |
| 1.2 | Select more than 10 seats | 11th click blocked in UI; API rejects >10 with 400 | Handled |
| 1.3 | Duplicate seat IDs in one request (crafted API call) | 400 "Duplicate seats in selection" | Handled |
| 1.4 | Non-existent seat ID e.g. `Z99` (crafted API call) | 400 "Invalid seats" | Handled |
| 1.5 | Click a seat already booked/held by another user | Button disabled; server would 409 anyway | Handled |
| 1.6 | Seat taken by another user *after* page load but *before* Pay (stale seat map) | `/api/orders` returns 409 with the conflicting seats; UI deselects them and refreshes the map | Handled |
| 1.7 | Two users click Pay for the same seat at the same instant (race) | Lock is all-or-nothing; exactly one order succeeds, the other gets 409. True atomicity across instances needs DB/Redis | Handled (single instance) |
| 1.8 | Seat map poll fails (network drop) | Last known state kept; conflict still caught server-side at order time | Handled |

## 2. Show & timing

| # | Test case | Expected behaviour | Status |
|---|---|---|---|
| 2.1 | Book before registration opens | "Select seats" disabled on the event page; `/api/orders` rejects with 409 "Registration has not opened yet" | Handled |
| 2.2 | Book after registration closes (or event started) | Booking page redirects back; `/api/orders` re-checks the window and rejects with 409 | Handled |
| 2.3 | Registration closes *while* user is picking seats | UI still allows it, but `/api/orders` re-checks and rejects | Handled |
| 2.4 | Invalid/garbled `eventId` in API call | 404 "Event not found" | Handled |
| 2.5 | Unpublished (draft) event booked via crafted API call | Treated as not found — drafts are never bookable | Handled |
| 2.6 | Timezone: dates are stored as ISO/UTC and rendered in IST | Registration window comparisons are epoch-based, render is `Asia/Kolkata` | Handled |

## 3. Order creation & pricing

| # | Test case | Expected behaviour | Status |
|---|---|---|---|
| 3.1 | Client tampers with the amount | Impossible — client never sends an amount; server computes from ticket categories | Handled |
| 3.2 | Malformed JSON body | 400 "Invalid JSON body", no crash | Handled |
| 3.3 | Missing/invalid email | 400 before any lock is taken | Handled |
| 3.4 | Razorpay API down / keys revoked mid-flight | 502, and **locked seats are released** — no stranded seats | Handled |
| 3.5 | Env keys not configured | 500 with a clear message instead of a crash | Handled |
| 3.6 | User double-clicks Pay | `paying` flag blocks re-entry; second order can't lock the same seats anyway (409) | Handled |
| 3.7 | Order created but user never opens/completes checkout | 8-minute lock TTL expires; seats return to pool automatically | Handled |

## 4. Payment (Razorpay checkout)

| # | Test case | Expected behaviour | Status |
|---|---|---|---|
| 4.1 | Checkout.js script fails to load (adblock, offline) | Error shown, order released immediately | Handled |
| 4.2 | User dismisses the checkout modal without paying | `ondismiss` → `/api/release` frees seats, booking marked FAILED | Handled |
| 4.3 | Payment fails (declined card, wrong OTP, UPI timeout) | Razorpay keeps modal open for retry against the **same order** — seats stay held for the same user | Handled |
| 4.4 | User pays, then closes the tab before `handler` runs | `payment.captured` webhook confirms the booking server-side, generates the ticket and emails it (requires `RAZORPAY_WEBHOOK_SECRET` configured) | Handled (with webhook) |
| 4.5 | Network drops between payment success and `/api/verify` | Same as 4.4 — the webhook is authoritative and idempotent; a later `/api/verify` replay returns the same ticket | Handled (with webhook) |
| 4.6 | Slow payment (UPI approval takes minutes) → lock expires and seats re-sold before capture lands | Webhook re-locks before confirming; on conflict it does NOT overbook — logs `CONFLICT — seats re-sold` in the payments log for a manual refund | Handled (manual refund step) |
| 4.7 | Webhook fires for a booking whose own lock is still held (the common case — verify hasn't run yet) | The re-lock in 4.6 must not conflict with the SAME order's own still-active hold — `lockSeats` only treats a *different* order's lock as a conflict | Handled |
| 4.7 | User opens two tabs, pays for different seats in each | Independent orders/locks — both succeed legitimately | Handled |

## 5. Verification & signature security

| # | Test case | Expected behaviour | Status |
|---|---|---|---|
| 5.1 | Forged signature (attacker posts fake success to `/api/verify`) | HMAC mismatch → 400, booking FAILED, seats released | Handled |
| 5.2 | Signature from a *different* order pasted in | HMAC is bound to `order_id\|payment_id` — mismatch → 400 | Handled |
| 5.3 | Timing attack on signature comparison | `crypto.timingSafeEqual` used | Handled |
| 5.4 | Replay a valid verify payload twice (double-submit, retry) | Idempotent — same CONFIRMED booking returned, seats not double-processed | Handled |
| 5.5 | Verify for an unknown `order_id` | 404 "Unknown order" | Handled |
| 5.6 | Missing signature fields / non-string types | 400 "Missing payment fields" | Handled |
| 5.7 | Verify called *after* lock expired and seats re-sold (see 4.6) | Currently confirms → possible double booking | **Prod-gap** |

## 6. Release endpoint abuse

| # | Test case | Expected behaviour | Status |
|---|---|---|---|
| 6.1 | Attacker calls `/api/release` with someone else's orderId to free their held seats | 403 — release requires the per-order `releaseToken` (HMAC, returned only to the order's creator) | Handled |
| 6.2 | Release called on a CONFIRMED booking | 409 rejected — paid seats can never be un-booked this way | Handled |
| 6.3 | Release called twice | Second call is a harmless no-op on already-freed locks | Handled |

## 7. Ticket generation & email delivery

| # | Test case | Expected behaviour | Status |
|---|---|---|---|
| 7.1 | SMTP not configured | Booking still confirms; UI says "Email delivery is unavailable — save the ticket below" and shows ticket + QR on screen | Handled |
| 7.2 | SMTP configured but send fails (bad password, provider down, recipient rejected) | `sendTicketEmail` catches, booking stays CONFIRMED, `emailSent:false` returned; ticket shown on screen | Handled |
| 7.3 | Verify replayed after confirmation | Same `ticketId` returned, identical QR regenerated, email **not** resent | Handled |
| 7.4 | Two bookings get the same ticket ID | 12 chars from a 32-symbol crypto-random alphabet ≈ 2^60 space — collision practically impossible | Handled |
| 7.5 | Ticket forged by guessing IDs | IDs are unguessable; but QR payload is client-verifiable only — gate scanner must check against the server | **Prod-gap** — signed QR (HMAC) + scanner API |
| 7.6 | Email goes to spam / wrong address typed by user | Ticket always shown on screen as fallback; no address verification exists | **Prod-gap** — OTP-verify the email or require login |
| 7.7 | Slow SMTP server delays the verify response | Email is awaited in the request path; a hung SMTP connection stalls confirmation UI | **Prod-gap** — queue email in a background job |

## 8. Infrastructure & state

| # | Test case | Expected behaviour | Status |
|---|---|---|---|
| 8.1 | Dev server hot-reload mid-booking | Pg pool + seat locks live on `globalThis` — survive HMR without leaking a new pool per reload | Handled |
| 8.2 | Server restart between order and verify | Bookings/events persist to Postgres; only seat *locks* are lost (they'd expire anyway) — held seats briefly reopen, verify still finds the booking | Handled |
| 8.3 | Multiple server instances / serverless (Vercel) | Events/bookings/accounts are safely shared via Postgres. Seat *locks* are still per-instance memory — they don't propagate, so two instances could both accept a hold on the same seat | **Prod-gap** — shared Redis lock (`SET NX`) needed for the lock step specifically |
| 8.4 | Two verifies for the same order race each other | Both read PENDING → both confirm and may generate two ticket IDs / send two emails. Prod needs an atomic compare-and-set on status | Handled-ish (single-threaded Node event loop makes the window tiny) |

## 9. Admin & refunds

| # | Test case | Expected behaviour | Status |
|---|---|---|---|
| 9.1 | Admin API called without/with expired session cookie | 401 Unauthorized; admin pages redirect to `/admin/login` | Handled |
| 9.2 | Session cookie forged | HMAC-signed with a server secret, timing-safe compare | Handled |
| 9.3 | Wrong admin password (brute force) | 401 "Incorrect email or password" (same message for unknown email); 429 after 8 attempts/min per client | Handled |
| 9.4 | Delete an event that has confirmed bookings | 409 — must unpublish instead; tickets stay valid | Handled |
| 9.5 | Shrink an event's seat layout below already-sold seats | 409 listing the orphaned seats | Handled |
| 9.6 | Refund a non-confirmed / already-refunded booking | 409 rejected | Handled |
| 9.7 | Refund succeeds | Booking → REFUNDED, seats return to sale, ticket page 404s | Handled |
| 9.8 | Razorpay refund API fails | 502 with the gateway description; booking stays CONFIRMED | Handled |
| 9.9 | CSV export with formula-like fields (`=cmd()` in a name) | Cells are quoted and `=+-@` prefixed with `'` — no formula injection | Handled |
| 9.10 | Webhook with a forged/absent signature | 400 — HMAC over the raw body, timing-safe compare | Handled |
| 9.11 | Webhook replayed (Razorpay retries) | Idempotent — CONFIRMED/REFUNDED bookings are no-ops; every delivery logged | Handled |
| 9.12 | Scripted seat-hoarding via rapid order creation | 429 after 10 order attempts/min per client (in-memory; per-instance) | Handled (single instance) |
| 9.13 | Blocking an already-sold seat | 409 listing the clash; blocked seats present as sold to the public and can't be locked | Handled |
| 9.14 | Booking lookup by guessed booking ID | Requires matching email; identical 404 for wrong ID vs wrong email; rate-limited | Handled |

## 10. Admin roles & permissions

| # | Test case | Expected behaviour | Status |
|---|---|---|---|
| 10.1 | Admin with only "bookings" permission calls `/api/admin/events` | 403 "Missing events permission" | Handled |
| 10.2 | Same admin calls `/api/admin/refund` | 403 "Missing refunds permission" | Handled |
| 10.3 | Same admin calls `/api/admin/bookings/export` | 200 — has the "bookings" permission | Handled |
| 10.4 | Non-super-admin calls any `/api/admin/users/*` route | 403 "Only super admins can manage admin users" | Handled |
| 10.5 | A super admin tries to delete their own account | 400 — must ask another super admin | Handled |
| 10.6 | A super admin tries to demote themself while they're the only super admin | 409 "Cannot demote the last super admin" | Handled |
| 10.7 | Promote a second admin to super admin, then demote the first | Succeeds once ≥2 super admins exist | Handled |
| 10.8 | Create an admin account with a duplicate email | 409 | Handled |
| 10.9 | Create an admin account with a password under 8 characters | 400 | Handled |
| 10.10 | A permission is revoked from a user with an active session | Takes effect on their very next request — sessions re-resolve the live user record, no re-login needed | Handled |
| 10.11 | Visiting `/admin/bookings` or `/admin/users` without the right role/permission | Inline "Access denied" panel (not a redirect loop) | Handled |
| 10.12 | Password storage | scrypt with a random salt per user, stored as `salt:hash`; plaintext never persisted or logged | Handled |

## 11. Customer auth & per-attendee tickets

| # | Test case | Expected behaviour | Status |
|---|---|---|---|
| 11.1 | Book without signing in | Booking page 307s to `/login?next=…`; `/api/orders` returns 401 — enforced server-side | Handled |
| 11.2 | Guess an OTP | Wrong code → 400; 6th wrong attempt kills the code; codes expire in 5 min and are single-use (replay → "expired") | Handled |
| 11.3 | OTP database leak | Only HMACs of codes are stored — live codes are not recoverable | Handled |
| 11.4 | OTP bombing a victim's phone/email | 3 sends per contact per 10 min (plus a per-client-IP limit) → 429 | Handled |
| 11.5 | OTP visible to the client before delivery | Never — codes go out via email/SMS only (server console in dev); no API response contains one | Handled |
| 11.6 | Signup verify without a name | 400 BEFORE the code is consumed — a missing name doesn't burn the OTP | Handled |
| 11.7 | Password brute force / enumeration | Rate-limited; identical 401 for unknown account, wrong password and no-password account | Handled |
| 11.8 | Stolen session cookie changes the password | Changing an existing password requires the current one | Handled |
| 11.9 | Tampered `next` redirect (`//evil.com`) | Only same-origin relative paths pass `sanitizeNextPath` | Handled |
| 11.10 | Booking contact spoofing | Contact details come from the verified signed-in profile — the client no longer sends email/phone at checkout | Handled |
| 11.11 | Multi-person booking | One attendee name required per seat (400 without); each attendee gets an individual QR ticket with its own `/ticket/[id]` page | Handled |
| 11.12 | Verify replay after multi-ticket confirmation | `ensureTicketsForBooking` is idempotent — same tickets returned, never duplicated | Handled |
| 11.13 | Customer cookie used on admin routes (or vice versa) | Separate cookie names and audiences — admin APIs re-resolve `admin_users`, customer APIs `customers` | Handled |

## How to exercise these in Razorpay test mode

- **Success:** card `4111 1111 1111 1111`, any future expiry/CVV, OTP `1234`; UPI `success@razorpay`
- **Failure:** UPI `failure@razorpay`, or click "Failure" in the test-mode OTP screen
- **Dismiss:** just close the checkout modal (tests 4.2)
- **Forged verify (5.1):** `curl -X POST localhost:3000/api/verify -H 'Content-Type: application/json' -d '{"razorpay_order_id":"<real-order>","razorpay_payment_id":"pay_fake","razorpay_signature":"deadbeef"}'`
- **Race (1.7):** open two browsers, select the same seat, hit Pay in both
- **Lock expiry (3.7):** create an order, close the modal *without* letting `ondismiss` fire (kill the tab), wait 8 min, refresh
