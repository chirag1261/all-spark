import { NextRequest, NextResponse } from "next/server";

import { getCurrentCustomer } from "@/lib/auth/customer";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { updateCustomer } from "@/lib/db";
import { clientKey, rateLimit } from "@/lib/http/ratelimit";

/**
 * POST /api/account/password — Body: { newPassword, currentPassword? }
 * Sets or changes the customer's password. Changing an EXISTING password
 * requires the current one — a stolen session cookie alone can't silently
 * take over the account's credentials.
 */
export async function POST(req: NextRequest) {
  const customer = await getCurrentCustomer();
  if (!customer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!rateLimit(`pwd-change:${clientKey(req)}`, 5, 10 * 60_000)) {
    return NextResponse.json({ error: "Too many attempts — try again later" }, { status: 429 });
  }

  let body: { newPassword?: unknown; currentPassword?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
  if (newPassword.length < 8 || newPassword.length > 128) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  if (customer.passwordHash) {
    const current = typeof body.currentPassword === "string" ? body.currentPassword : "";
    if (!current || !verifyPassword(current, customer.passwordHash)) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 });
    }
  }

  await updateCustomer(customer.id, { passwordHash: hashPassword(newPassword) });
  return NextResponse.json({ ok: true });
}
