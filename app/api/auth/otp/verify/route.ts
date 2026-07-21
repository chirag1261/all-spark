import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

import {
  CUSTOMER_COOKIE,
  CUSTOMER_SESSION_MAX_AGE,
  createCustomerSessionToken,
  normalizeIdentifier,
} from "@/lib/auth/customer";
import { verifyOtp } from "@/lib/auth/otp";
import { createCustomer, getCustomerByIdentifier, updateCustomer } from "@/lib/db";
import { clientKey, rateLimit } from "@/lib/http/ratelimit";
import { Customer } from "@/types";

/**
 * POST /api/auth/otp/verify — Body: { identifier, code, name? }
 * Verifies the OTP. Existing account → login. New account → signup, which
 * requires `name` (the wizard collects it before sending the code).
 * OTP verification IS the contact verification — the email/phone is marked
 * verified, which checkout later relies on for ticket delivery.
 */
export async function POST(req: NextRequest) {
  if (!rateLimit(`otp-verify:${clientKey(req)}`, 15, 10 * 60_000)) {
    return NextResponse.json({ error: "Too many attempts — try again later" }, { status: 429 });
  }

  let body: { identifier?: unknown; code?: unknown; name?: unknown };
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

  // Check signup requirements BEFORE verifying — verification consumes the
  // (single-use) code, and a missing name must not burn it.
  const existing = await getCustomerByIdentifier(normalized.identifier);
  const signupName = typeof body.name === "string" ? body.name.trim() : "";
  if (!existing && (signupName.length < 2 || signupName.length > 80)) {
    return NextResponse.json({ error: "Enter your name to create the account" }, { status: 400 });
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

  // Re-read after verification — the account could have been created between
  // the pre-check and now; getCustomerByIdentifier makes this idempotent.
  let customer = await getCustomerByIdentifier(normalized.identifier);
  const now = Date.now();
  const isNew = !customer;

  if (!customer) {
    const fresh: Customer = {
      id: `cus_${crypto.randomBytes(6).toString("hex")}`,
      name: signupName,
      email: normalized.channel === "email" ? normalized.identifier : null,
      phone: normalized.channel === "phone" ? normalized.identifier : null,
      passwordHash: null,
      emailVerified: normalized.channel === "email",
      phoneVerified: normalized.channel === "phone",
      createdAt: now,
      updatedAt: now,
      lastLoginAt: now,
    };
    await createCustomer(fresh);
    customer = fresh;
  } else {
    await updateCustomer(customer.id, {
      lastLoginAt: now,
      ...(normalized.channel === "email" ? { emailVerified: true } : { phoneVerified: true }),
    });
  }

  const res = NextResponse.json({
    ok: true,
    isNew,
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
