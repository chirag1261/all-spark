import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

import {
  CUSTOMER_COOKIE,
  CUSTOMER_SESSION_MAX_AGE,
  createCustomerSessionToken,
  normalizeIdentifier,
} from "@/lib/auth/customer";
import { verifySignupProof } from "@/lib/auth/otp";
import { createCustomer, getCustomerByIdentifier } from "@/lib/db";
import { clientKey, rateLimit } from "@/lib/http/ratelimit";
import { Customer } from "@/types";

/**
 * POST /api/auth/signup
 * Body: { name, phone, phoneProof, email? }
 *
 * OTP-only accounts — no password anywhere. Phone is mandatory and must
 * carry a valid signup proof from /api/auth/otp/verify?purpose=signup.
 * Email is optional and, unlike phone, is never itself OTP-verified — the
 * client (components/PhoneAuth) only ever collects a phone code, so it has
 * no email proof to send. Stored as unverified contact info when given; if
 * omitted, the account is simply created without an email on file.
 */
export async function POST(req: NextRequest) {
  if (!rateLimit(`signup:${clientKey(req)}`, 8, 60_000)) {
    return NextResponse.json(
      { error: "Too many attempts — please wait a minute and retry" },
      { status: 429 }
    );
  }

  let body: {
    name?: unknown;
    email?: unknown;
    phone?: unknown;
    phoneProof?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const phoneN = normalizeIdentifier(body.phone);
  // Email is optional — only normalize/validate it when something was sent.
  const hasEmail = typeof body.email === "string" && body.email.trim().length > 0;
  const emailN = hasEmail ? normalizeIdentifier(body.email) : null;

  if (name.length < 1 || name.length > 80) {
    return NextResponse.json({ error: "Enter your name" }, { status: 400 });
  }
  if (!phoneN || phoneN.channel !== "phone") {
    return NextResponse.json({ error: "Enter a valid phone number" }, { status: 400 });
  }
  if (hasEmail && (!emailN || emailN.channel !== "email")) {
    return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  }

  // Phone always needs its own verification proof.
  if (!verifySignupProof(phoneN.identifier, body.phoneProof)) {
    return NextResponse.json(
      { error: "Please verify your phone number, then try again." },
      { status: 400 }
    );
  }
  // Uniqueness (DB UNIQUE on both columns is the final backstop below).
  if (await getCustomerByIdentifier(phoneN.identifier)) {
    return NextResponse.json(
      { error: "That phone number is already registered — please sign in." },
      { status: 409 }
    );
  }
  if (emailN && (await getCustomerByIdentifier(emailN.identifier))) {
    return NextResponse.json(
      { error: "That email is already registered — please sign in." },
      { status: 409 }
    );
  }

  const now = Date.now();
  const customer: Customer = {
    id: `cus_${crypto.randomBytes(6).toString("hex")}`,
    name,
    email: emailN?.identifier ?? null,
    phone: phoneN.identifier,
    passwordHash: null, // OTP-only — no passwords
    emailVerified: false, // email is never OTP-verified in this flow
    phoneVerified: true,
    createdAt: now,
    updatedAt: now,
    lastLoginAt: now,
  };

  try {
    await createCustomer(customer);
  } catch {
    // Unique-constraint race (email or phone taken between the check and insert).
    return NextResponse.json(
      { error: "That email or phone number is already registered — please sign in." },
      { status: 409 }
    );
  }

  const res = NextResponse.json({
    ok: true,
    customer: { id: customer.id, name: customer.name, email: customer.email, phone: customer.phone },
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
