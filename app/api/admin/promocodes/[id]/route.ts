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
import { AdminUser } from "@/types";

async function requirePromoAdmin(): Promise<{ user?: AdminUser; error?: NextResponse }> {
  const user = await getCurrentAdmin();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!hasPermission(user, "promocodes")) {
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
      return NextResponse.json({ error: "A promo code with that code already exists" }, {
        status: 409,
      });
    }
  }

  // Never let the cap drop below what's already been redeemed.
  if (parsed.value.maxRedemptions != null && parsed.value.maxRedemptions < target.redemptionCount) {
    return NextResponse.json(
      {
        error: `Usage limit can't be below the ${target.redemptionCount} redemption(s) already used`,
      },
      { status: 409 }
    );
  }

  const updated = await updatePromoCode(id, parsed.value);
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
    return NextResponse.json(
      { error: "This code has already been used — deactivate it instead of deleting." },
      { status: 409 }
    );
  }

  await deletePromoCode(id);
  await audit("promo.delete", "promo_code", id, `Deleted promo code "${target.code}"`);
  return NextResponse.json({ deleted: true });
}
