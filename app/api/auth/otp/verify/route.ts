import { NextRequest, NextResponse } from "next/server";

import {
  CUSTOMER_COOKIE,
  CUSTOMER_SESSION_MAX_AGE,
  createCustomerSessionToken,
  normalizeIdentifier,
} from "@/lib/auth/customer";
import { resetProof, signupProof, verifyOtp } from "@/lib/auth/otp";
import { getCustomerByIdentifier, updateCustomer } from "@/lib/db";
import { clientKey, rateLimit } from "@/lib/http/ratelimit";

/**
 * POST /api/auth/otp/verify — Body: { identifier, code, purpose? }
 *
 * Three purposes:
 *  - "signup": verifies one contact of a NEW account. Returns a short-lived
 *    signed proof; does NOT create an account or a session (the account is
 *    created by /api/auth/signup once both the email and phone proofs are
 *    presented). Channel-agnostic — called once for email, once for phone.
 *  - "reset": verifies an EXISTING account's contact for a password reset.
 *    Returns a short-lived signed proof; does NOT sign in (the new password
 *    is set by /api/auth/password/reset, which signs the user in afterward).
 *  - "login" (default): verifies an EXISTING account's contact and signs in.
 *    Unknown identifiers are rejected — accounts are never auto-created here.
 */
export async function POST(req: NextRequest) {
  if (!rateLimit(`otp-verify:${clientKey(req)}`, 15, 10 * 60_000)) {
    return NextResponse.json({ error: "Too many attempts — try again later" }, { status: 429 });
  }

  let body: { identifier?: unknown; code?: unknown; purpose?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const normalized = normalizeIdentifier(body.identifier);
  if (!normalized) {
    return NextResponse.json({ error: "Enter a valid email or phone number" }, { status: 400 });
  }
  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: "Enter the 6-digit code" }, { status: 400 });
  }
  const purpose =
    body.purpose === "signup" ? "signup" : body.purpose === "reset" ? "reset" : "login";

  const existing = await getCustomerByIdentifier(normalized.identifier);

  // Guard BEFORE verifying (verification consumes the single-use code):
  if (purpose === "signup" && existing) {
    const which = normalized.channel === "email" ? "email" : "phone number";
    return NextResponse.json(
      { error: `That ${which} is already registered — please sign in instead.` },
      { status: 409 }
    );
  }
  // Both login and reset act on an existing account.
  if ((purpose === "login" || purpose === "reset") && !existing) {
    return NextResponse.json(
      { error: "No account found — please create one first." },
      { status: 404 }
    );
  }

  const result = await verifyOtp(normalized.identifier, code);
  if (result === "locked") {
    return NextResponse.json(
      { error: "Too many wrong attempts — request a new code" },
      { status: 429 }
    );
  }
  if (result === "expired") {
    return NextResponse.json({ error: "Code expired — request a new one" }, { status: 400 });
  }
  if (result === "invalid") {
    return NextResponse.json({ error: "Incorrect code" }, { status: 400 });
  }

  // ---- Signup: hand back a proof, no account/session yet. ----
  if (purpose === "signup") {
    return NextResponse.json({ ok: true, proof: signupProof(normalized.identifier) });
  }

  // ---- Reset: hand back a proof, no session yet (the password-reset endpoint
  //      sets the new password and signs the user in). ----
  if (purpose === "reset") {
    return NextResponse.json({ ok: true, proof: resetProof(normalized.identifier) });
  }

  // ---- Login: mark this contact verified and sign in. ----
  const customer = existing!;
  await updateCustomer(customer.id, {
    lastLoginAt: Date.now(),
    ...(normalized.channel === "email" ? { emailVerified: true } : { phoneVerified: true }),
  });

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
