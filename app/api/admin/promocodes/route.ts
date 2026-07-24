import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

import { getCurrentAdmin, hasPermission } from "@/lib/auth/admin";
import { audit, createPromoCode, getPromoCodeByCode, listPromoCodes } from "@/lib/db";
import { validatePromoCodeInput } from "@/lib/domain/promocodes";

/** GET /api/admin/promocodes — list all promo codes. */
export async function GET() {
  const user = await getCurrentAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(user, "promocodes")) {
    return NextResponse.json({ error: "Not allowed to manage promo codes" }, { status: 403 });
  }
  return NextResponse.json({ promoCodes: await listPromoCodes() });
}

/** POST /api/admin/promocodes — create a promo code. */
export async function POST(req: NextRequest) {
  const user = await getCurrentAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(user, "promocodes")) {
    return NextResponse.json({ error: "Not allowed to manage promo codes" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = validatePromoCodeInput(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  if (await getPromoCodeByCode(parsed.value.code)) {
    return NextResponse.json({ error: "A promo code with that code already exists" }, {
      status: 409,
    });
  }

  const now = Date.now();
  const promo = {
    id: `promo_${crypto.randomBytes(6).toString("hex")}`,
    ...parsed.value,
    redemptionCount: 0,
    createdAt: now,
    updatedAt: now,
  };
  await createPromoCode(promo);
  await audit("promo.create", "promo_code", promo.id, `Created promo code "${promo.code}"`);
  return NextResponse.json({ promoCode: promo }, { status: 201 });
}
