import { NextRequest, NextResponse } from "next/server";

import { getCurrentAdmin, hasPermission } from "@/lib/auth/admin";
import { audit, getPromoCodeById, setPromoCodeActive } from "@/lib/db";
import { logger } from "@/lib/logger";

/** POST /api/admin/promocodes/[id]/status — Body: { active: boolean } */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  if (!hasPermission(user, "promocodes")) {
    logger.be.warn("Promo code status change denied — missing permission", { userId: user.id, id });
    return NextResponse.json({ error: "Not allowed to manage promo codes" }, { status: 403 });
  }

  let body: { active?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (typeof body.active !== "boolean") {
    return NextResponse.json({ error: "active must be a boolean" }, { status: 400 });
  }

  const target = await getPromoCodeById(id);
  if (!target) return NextResponse.json({ error: "Promo code not found" }, { status: 404 });

  let updated;
  try {
    updated = await setPromoCodeActive(id, body.active);
  } catch (err) {
    logger.be.error("Promo code status change failed", { id, err: String(err) });
    return NextResponse.json({ error: "Could not update the promo code" }, { status: 500 });
  }
  await audit(
    body.active ? "promo.activate" : "promo.deactivate",
    "promo_code",
    id,
    `${body.active ? "Activated" : "Deactivated"} promo code "${target.code}"`
  );
  return NextResponse.json({ promoCode: updated });
}
