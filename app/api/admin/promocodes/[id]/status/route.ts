import { NextRequest, NextResponse } from "next/server";

import { getCurrentAdmin, hasPermission } from "@/lib/auth/admin";
import { audit, getPromoCodeById, setPromoCodeActive } from "@/lib/db";

/** POST /api/admin/promocodes/[id]/status — Body: { active: boolean } */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(user, "promocodes")) {
    return NextResponse.json({ error: "Not allowed to manage promo codes" }, { status: 403 });
  }

  const { id } = await ctx.params;

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

  const updated = await setPromoCodeActive(id, body.active);
  await audit(
    body.active ? "promo.activate" : "promo.deactivate",
    "promo_code",
    id,
    `${body.active ? "Activated" : "Deactivated"} promo code "${target.code}"`
  );
  return NextResponse.json({ promoCode: updated });
}
