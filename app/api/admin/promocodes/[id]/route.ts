import { NextRequest, NextResponse } from "next/server";

import { getCurrentAdmin, hasPermission } from "@/lib/auth/admin";
import {
  audit,
  deletePromoCode,
  getPromoCodeByCode,
  getPromoCodeById,
  updatePromoCode,
} from "@/lib/db";
import { validatePromoCodeInput } from "@/lib/domain/promocodes";
import { logger } from "@/lib/logger";
import { AdminUser } from "@/types";

async function requirePromoAdmin(): Promise<{ user?: AdminUser; error?: NextResponse }> {
  const user = await getCurrentAdmin();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!hasPermission(user, "promocodes")) {
    logger.be.warn("Promo code action denied — missing permission", { userId: user.id });
    return {
      error: NextResponse.json({ error: "Not allowed to manage promo codes" }, { status: 403 }),
    };
  }
  return { user };
}

/** GET /api/admin/promocodes/[id] */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requirePromoAdmin();
  if (auth.error) return auth.error;
  const { id } = await ctx.params;
  const promo = await getPromoCodeById(id);
  if (!promo) return NextResponse.json({ error: "Promo code not found" }, { status: 404 });
  return NextResponse.json({ promoCode: promo });
}

/** PUT /api/admin/promocodes/[id] */
export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requirePromoAdmin();
  if (auth.error) return auth.error;
  const { id } = await ctx.params;
  const target = await getPromoCodeById(id);
  if (!target) return NextResponse.json({ error: "Promo code not found" }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = validatePromoCodeInput(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  // Code must stay unique if it was changed.
  if (parsed.value.code !== target.code) {
    const owner = await getPromoCodeByCode(parsed.value.code);
    if (owner && owner.id !== id) {
      logger.be.warn("Promo code update blocked — duplicate code", { id, code: parsed.value.code });
      return NextResponse.json({ error: "A promo code with that code already exists" }, {
        status: 409,
      });
    }
  }

  // Never let the cap drop below what's already been redeemed.
  if (parsed.value.maxRedemptions != null && parsed.value.maxRedemptions < target.redemptionCount) {
    logger.be.warn("Promo code update blocked — cap below redemption count", {
      id,
      maxRedemptions: parsed.value.maxRedemptions,
      redemptionCount: target.redemptionCount,
    });
    return NextResponse.json(
      {
        error: `Usage limit can't be below the ${target.redemptionCount} redemption(s) already used`,
      },
      { status: 409 }
    );
  }

  let updated;
  try {
    updated = await updatePromoCode(id, parsed.value);
  } catch (err) {
    logger.be.error("Promo code update failed", { id, err: String(err) });
    return NextResponse.json({ error: "Could not update the promo code" }, { status: 500 });
  }
  await audit("promo.update", "promo_code", id, `Updated promo code "${updated!.code}"`);
  return NextResponse.json({ promoCode: updated });
}

/** DELETE /api/admin/promocodes/[id] — blocked once the code has been redeemed. */
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requirePromoAdmin();
  if (auth.error) return auth.error;
  const { id } = await ctx.params;
  const target = await getPromoCodeById(id);
  if (!target) return NextResponse.json({ error: "Promo code not found" }, { status: 404 });

  if (target.redemptionCount > 0) {
    logger.be.warn("Promo code delete blocked — already redeemed", {
      id,
      redemptionCount: target.redemptionCount,
    });
    return NextResponse.json(
      { error: "This code has already been used — deactivate it instead of deleting." },
      { status: 409 }
    );
  }

  try {
    await deletePromoCode(id);
  } catch (err) {
    logger.be.error("Promo code delete failed", { id, err: String(err) });
    return NextResponse.json({ error: "Could not delete the promo code" }, { status: 500 });
  }
  await audit("promo.delete", "promo_code", id, `Deleted promo code "${target.code}"`);
  return NextResponse.json({ deleted: true });
}
