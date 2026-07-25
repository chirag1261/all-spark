import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

import {
  CUSTOMER_COOKIE,
  CUSTOMER_SESSION_MAX_AGE,
  createCustomerSessionToken,
  normalizeIdentifier,
} from "@/lib/auth/customer";
import { verifySignupProof } from "@/lib/auth/otp";
import { hashPassword } from "@/lib/auth/password";
import { createCustomer, getCustomerByIdentifier } from "@/lib/db";
import { clientKey, rateLimit } from "@/lib/http/ratelimit";
import { Customer } from "@/types";

/**
 * POST /api/auth/signup
 * Body: { name, email, phone, password, emailProof, phoneProof }
 *
 * Final step of signup: creates the account once BOTH the email and phone
 * were OTP-verified (each proven by a signed proof from
 * /api/auth/otp/verify?purpose=signup), with a password set, then signed in.
 * See the matching two-step flow in components/LoginWizard for the client side.
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
    password?: unknown;
    emailProof?: unknown;
    phoneProof?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const emailN = normalizeIdentifier(body.email);
  const phoneN = normalizeIdentifier(body.phone);

  if (name.length < 2 || name.length > 80) {
    return NextResponse.json({ error: "Enter your name (2–80 characters)" }, { status: 400 });
  }
  if (!emailN || emailN.channel !== "email") {
    return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  }
  if (!phoneN || phoneN.channel !== "phone") {
    return NextResponse.json({ error: "Enter a valid phone number" }, { status: 400 });
  }
  if (password.length < 8 || password.length > 128) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  // Both contacts must carry a valid, unexpired verification proof.
  if (!verifySignupProof(emailN.identifier, body.emailProof)) {
    return NextResponse.json(
      { error: "Please verify your email, then try again." },
      { status: 400 }
    );
  }
  if (!verifySignupProof(phoneN.identifier, body.phoneProof)) {
    return NextResponse.json(
      { error: "Please verify both your email and phone, then try again." },
      { status: 400 }
    );
  }

  // Uniqueness (DB UNIQUE on both columns is the final backstop below).
  if (await getCustomerByIdentifier(emailN.identifier)) {
    return NextResponse.json(
      { error: "That email is already registered — please sign in." },
      { status: 409 }
    );
  }
  if (await getCustomerByIdentifier(phoneN.identifier)) {
    return NextResponse.json(
      { error: "That phone number is already registered — please sign in." },
      { status: 409 }
    );
  }

  const now = Date.now();
  const customer: Customer = {
    id: `cus_${crypto.randomBytes(6).toString("hex")}`,
    name,
    email: emailN.identifier,
    phone: phoneN.identifier,
    passwordHash: hashPassword(password),
    emailVerified: true,
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
