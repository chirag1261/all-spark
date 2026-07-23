import { PromoCode, PromoDiscountType } from "@/types";

/**
 * Promo-code validation + discount computation. Pure, I/O-free — the single
 * source of truth for both the admin form's server validation and the
 * customer-facing apply path (/api/promo/validate + /api/orders), so the money
 * math can never diverge between "preview" and "charge".
 */

export interface PromoCodeInput {
  code?: unknown;
  discountType?: unknown;
  discountValue?: unknown; // rupees in the admin form; converted to paise here
  maxDiscount?: unknown; // rupees
  minOrderAmount?: unknown; // rupees
  eventId?: unknown;
  maxRedemptions?: unknown;
  validFrom?: unknown; // ISO string or epoch ms
  validTo?: unknown;
  active?: unknown;
}

export type ValidatedPromoCode = Omit<
  PromoCode,
  "id" | "redemptionCount" | "createdAt" | "updatedAt"
>;

const CODE_RE = /^[A-Z0-9]{3,20}$/;

function toPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

function toEpoch(v: unknown): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = typeof v === "number" ? v : new Date(v as string).getTime();
  return Number.isFinite(n) ? n : null;
}

/**
 * Validates admin create/update input, returning the sanitized promo (money in
 * paise) or a human error. Lenient about the numeric field being a string
 * (form inputs), strict about the business rules.
 */
export function validatePromoCodeInput(
  body: PromoCodeInput
): { ok: true; value: ValidatedPromoCode } | { ok: false; error: string } {
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

  const code = str(body.code).toUpperCase();
  if (!code) return { ok: false, error: "Code is required" };
  if (!CODE_RE.test(code)) {
    return { ok: false, error: "Code must be 3–20 letters/digits, no spaces or symbols" };
  }

  const discountType = str(body.discountType) as PromoDiscountType;
  if (discountType !== "flat" && discountType !== "percent") {
    return { ok: false, error: 'Discount type must be "flat" or "percent"' };
  }

  const rawValue = Number(body.discountValue);
  if (!Number.isFinite(rawValue) || rawValue <= 0) {
    return { ok: false, error: "Discount value must be a positive number" };
  }

  let discountValue: number;
  let maxDiscount: number | null = null;
  if (discountType === "percent") {
    if (!Number.isInteger(rawValue) || rawValue < 1 || rawValue > 100) {
      return { ok: false, error: "Percentage must be a whole number between 1 and 100" };
    }
    discountValue = rawValue;
    const rawCap = Number(body.maxDiscount);
    if (!Number.isFinite(rawCap) || rawCap <= 0) {
      return { ok: false, error: "A maximum discount cap (₹) is required for percentage codes" };
    }
    maxDiscount = toPaise(rawCap);
  } else {
    discountValue = toPaise(rawValue); // flat amount in paise
  }

  let minOrderAmount = 0;
  if (body.minOrderAmount !== undefined && body.minOrderAmount !== "") {
    const rawMin = Number(body.minOrderAmount);
    if (!Number.isFinite(rawMin) || rawMin < 0) {
      return { ok: false, error: "Minimum order amount can't be negative" };
    }
    minOrderAmount = toPaise(rawMin);
  }

  let maxRedemptions: number | null = null;
  if (body.maxRedemptions !== undefined && body.maxRedemptions !== "") {
    const rawMax = Number(body.maxRedemptions);
    if (!Number.isInteger(rawMax) || rawMax < 1) {
      return { ok: false, error: "Usage limit must be a whole number of at least 1" };
    }
    maxRedemptions = rawMax;
  }

  const validFrom = toEpoch(body.validFrom);
  const validTo = toEpoch(body.validTo);
  if (validFrom !== null && validTo !== null && validFrom >= validTo) {
    return { ok: false, error: '"Valid from" must be before "valid until"' };
  }

  const eventId = str(body.eventId) || null;
  const active = body.active === undefined ? true : Boolean(body.active);

  return {
    ok: true,
    value: {
      code,
      discountType,
      discountValue,
      maxDiscount,
      minOrderAmount,
      eventId,
      maxRedemptions,
      validFrom,
      validTo,
      active,
    },
  };
}

/**
 * Checks eligibility and computes the discount (in paise) for a code against an
 * order. `subtotal` is the authoritative server-computed seat total. Returns
 * the integer-paise discount, or a customer-friendly rejection reason.
 */
export function evaluatePromo(
  promo: PromoCode,
  { eventId, subtotal, now }: { eventId: string; subtotal: number; now: number }
): { ok: true; discount: number } | { ok: false; reason: string } {
  if (!promo.active) return { ok: false, reason: "This code is no longer active" };
  if (promo.validFrom != null && now < promo.validFrom) {
    return { ok: false, reason: "This code isn't active yet" };
  }
  if (promo.validTo != null && now > promo.validTo) {
    return { ok: false, reason: "This code has expired" };
  }
  if (promo.eventId != null && promo.eventId !== eventId) {
    return { ok: false, reason: "This code isn't valid for this event" };
  }
  if (promo.maxRedemptions != null && promo.redemptionCount >= promo.maxRedemptions) {
    return { ok: false, reason: "This code has reached its usage limit" };
  }
  if (subtotal < promo.minOrderAmount) {
    const min = Math.ceil(promo.minOrderAmount / 100);
    return { ok: false, reason: `Minimum order of ₹${min} required for this code` };
  }

  let discount: number;
  if (promo.discountType === "flat") {
    discount = promo.discountValue;
  } else {
    discount = Math.round((subtotal * promo.discountValue) / 100);
    if (promo.maxDiscount != null) discount = Math.min(discount, promo.maxDiscount);
  }
  discount = Math.min(discount, subtotal); // never exceed the order
  if (discount <= 0) return { ok: false, reason: "This code doesn't apply to your order" };

  return { ok: true, discount };
}
