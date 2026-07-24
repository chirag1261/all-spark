import { NextRequest, NextResponse } from "next/server";

import { getEvent, getPromoCodeByCode } from "@/lib/db";
import { isValidSeatId, seatPrice } from "@/lib/domain/events";
import { evaluatePromo } from "@/lib/domain/promocodes";
import { clientKey, rateLimit } from "@/lib/http/ratelimit";

/**
 * POST /api/promo/validate — Body: { code, eventId, seatIds }
 *
 * Previews a promo code for the order-summary step. Recomputes the subtotal
 * server-side from the seat ids (never trusts a client amount) and returns the
 * discount, or a friendly rejection reason. Read-only — no redemption is
 * counted here (that happens at confirmed payment in /api/verify).
 */
export async function POST(req: NextRequest) {
  // Promo codes are guessable — rate-limit to deter brute-force enumeration.
  if (!rateLimit(`promo:${clientKey(req)}`, 15, 60_000)) {
    return NextResponse.json(
      { ok: false, error: "Too many attempts — please wait a minute." },
      { status: 429 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
  const eventId = typeof body.eventId === "string" ? body.eventId : "";
  const seatIdsRaw = Array.isArray(body.seatIds) ? body.seatIds : [];
  if (!code) return NextResponse.json({ ok: false, error: "Enter a promo code" }, { status: 400 });
  if (!eventId) {
    return NextResponse.json({ ok: false, error: "eventId is required" }, { status: 400 });
  }

  const event = await getEvent(eventId);
  if (!event) return NextResponse.json({ ok: false, error: "Event not found" }, { status: 404 });

  // Recompute the subtotal from valid seats only — this is the authoritative
  // figure the discount is applied to (mirrors /api/orders).
  const seatIds = seatIdsRaw
    .map((s) => (typeof s === "string" ? s.toUpperCase().trim() : ""))
    .filter((s) => s && isValidSeatId(event, s));
  if (seatIds.length === 0) {
    return NextResponse.json({ ok: false, error: "Select your seats first" }, { status: 400 });
  }
  const subtotal = seatIds.reduce((sum, id) => sum + (seatPrice(event, id) ?? 0), 0);

  const promo = await getPromoCodeByCode(code);
  // Same generic message whether the code is unknown or inactive — don't reveal
  // which codes exist.
  if (!promo) {
    return NextResponse.json({ ok: false, error: "This code isn't valid" }, { status: 200 });
  }

  const result = evaluatePromo(promo, { eventId, subtotal, now: Date.now() });
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.reason }, { status: 200 });
  }

  return NextResponse.json({
    ok: true,
    code: promo.code,
    discount: result.discount,
    subtotal,
    total: subtotal - result.discount,
  });
}
