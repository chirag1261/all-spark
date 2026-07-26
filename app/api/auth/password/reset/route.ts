import { NextRequest, NextResponse } from "next/server";

import {
  CUSTOMER_COOKIE,
  CUSTOMER_SESSION_MAX_AGE,
  createCustomerSessionToken,
  normalizeIdentifier,
} from "@/lib/auth/customer";
import { verifyResetProof } from "@/lib/auth/otp";
import { hashPassword } from "@/lib/auth/password";
import { getCustomerByIdentifier, updateCustomer } from "@/lib/db";
import { clientKey, rateLimit } from "@/lib/http/ratelimit";

/**
 * POST /api/auth/password/reset — Body: { identifier, proof, newPassword }
 *
 * The "forgot password" endpoint for a NOT-signed-in customer. Authorizes the
 * change with a short-lived reset proof — issued by /api/auth/otp/verify with
 * purpose "reset" once the account's own email/phone OTP was verified — rather
 * than the current password or a session (which the user can't provide, since
 * they can't sign in). Sets the new password and signs the user in.
 */
export async function POST(req: NextRequest) {
  if (!rateLimit(`pwd-reset:${clientKey(req)}`, 5, 10 * 60_000)) {
    return NextResponse.json({ error: "Too many attempts — try again later" }, { status: 429 });
  }

  let body: { identifier?: unknown; proof?: unknown; newPassword?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const normalized = normalizeIdentifier(body.identifier);
  if (!normalized) {
    return NextResponse.json({ error: "Enter a valid email or phone number" }, { status: 400 });
  }

  const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
  if (newPassword.length < 8 || newPassword.length > 128) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  // The proof is bound to this exact identifier and expires (~15 min) — reject
  // BEFORE touching the account so a bad/expired proof reveals nothing.
  if (!verifyResetProof(normalized.identifier, body.proof)) {
    return NextResponse.json(
      { error: "This reset link has expired. Please request a new code." },
      { status: 400 }
    );
  }

  const customer = await getCustomerByIdentifier(normalized.identifier);
  if (!customer) {
    return NextResponse.json({ error: "No account found for that contact." }, { status: 404 });
  }

  await updateCustomer(customer.id, {
    passwordHash: hashPassword(newPassword),
    lastLoginAt: Date.now(),
    // The contact was just OTP-verified to get here — mark it verified too.
    ...(normalized.channel === "email" ? { emailVerified: true } : { phoneVerified: true }),
  });

  // Sign the user in, matching every other terminal auth action.
  const res = NextResponse.json({
    ok: true,
    customer: {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
    },
  });
  res.cookies.set(CUSTOMER_COOKIE, createCustomerSessionToken(customer.id), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: CUSTOMER_SESSION_MAX_AGE,
  });
  return res;
}
