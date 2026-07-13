# Flow-Breaking Test Cases

Every scenario that can break the browse → seats → pay → confirm flow, grouped by stage.
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
| 2.1 | Book a show that already started | Showtime disabled in UI; API rejects with 409 | Handled |
| 2.2 | Show starts *while* user is picking seats | UI still allows it, but `/api/orders` re-checks start time and rejects | Handled |
| 2.3 | Invalid/garbled `showId` in API call | 404 "Show not found" | Handled |
| 2.4 | User keeps seat page open past midnight (date rollover) | `todayISO()` changes → old showId no longer resolves → 404 on order | Handled (crude) |
| 2.5 | Timezone: server UTC vs user IST | Naive `new Date("YYYY-MM-DDTHH:mm")` uses server-local time; show cutoffs can be wrong by 5.5h if server isn't IST | **Prod-gap** — store timestamps as epoch/UTC with explicit zone |

## 3. Order creation & pricing

| # | Test case | Expected behaviour | Status |
|---|---|---|---|
| 3.1 | Client tampers with the amount | Impossible — client never sends an amount; server computes from seat tiers | Handled |
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
| 4.4 | User pays, then closes the tab before `handler` runs | Client verify never fires. Money captured, seats stuck until lock expiry, then released — **paid but no ticket** | **Prod-gap** — Razorpay `payment.captured` webhook must confirm server-side |
| 4.5 | Network drops between payment success and `/api/verify` | Same as 4.4: client shows "could not verify"; webhook is the real fix | **Prod-gap** |
| 4.6 | Slow payment (UPI approval takes minutes) → lock expires mid-payment | Seats may be re-sold before verify lands. Current code confirms anyway (overbooking window). Prod: verify must re-check the lock is still owned, refund otherwise | **Prod-gap** |
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
| 6.1 | Attacker calls `/api/release` with someone else's orderId to free their held seats | Possible if orderId leaks (they're not guessable, but this endpoint is unauthenticated) | **Prod-gap** — tie release to a session/auth token |
| 6.2 | Release called on a CONFIRMED booking | 409 rejected — paid seats can never be un-booked this way | Handled |
| 6.3 | Release called twice | Second call is a harmless no-op on already-freed locks | Handled |

## 7. Infrastructure & state

| # | Test case | Expected behaviour | Status |
|---|---|---|---|
| 7.1 | Dev server hot-reload mid-booking | Store lives on `globalThis` — locks/bookings survive HMR | Handled |
| 7.2 | Server restart between order and verify | In-memory booking lost → verify 404s after a *successful payment* | **Prod-gap** — persistent DB |
| 7.3 | Multiple server instances / serverless (Vercel) | Each instance has its own memory — locks don't propagate → double booking | **Prod-gap** — shared Redis/DB |
| 7.4 | Two verifies for the same order race each other | Both read PENDING → both confirm. Same result (idempotent output), but prod needs an atomic compare-and-set | Handled-ish (single-threaded Node event loop makes the window tiny) |

## How to exercise these in Razorpay test mode

- **Success:** card `4111 1111 1111 1111`, any future expiry/CVV, OTP `1234`; UPI `success@razorpay`
- **Failure:** UPI `failure@razorpay`, or click "Failure" in the test-mode OTP screen
- **Dismiss:** just close the checkout modal (tests 4.2)
- **Forged verify (5.1):** `curl -X POST localhost:3000/api/verify -H 'Content-Type: application/json' -d '{"razorpay_order_id":"<real-order>","razorpay_payment_id":"pay_fake","razorpay_signature":"deadbeef"}'`
- **Race (1.7):** open two browsers, select the same seat, hit Pay in both
- **Lock expiry (3.7):** create an order, close the modal *without* letting `ondismiss` fire (kill the tab), wait 8 min, refresh
