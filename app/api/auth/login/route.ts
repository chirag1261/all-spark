import { NextRequest, NextResponse } from "next/server";

import {
  CUSTOMER_COOKIE,
  CUSTOMER_SESSION_MAX_AGE,
  createCustomerSessionToken,
  normalizeIdentifier,
} from "@/lib/auth/customer";
import { verifyPassword } from "@/lib/auth/password";
import { getCustomerByIdentifier, updateCustomer } from "@/lib/db";
import { clientKey, rateLimit } from "@/lib/http/ratelimit";

/**
 * POST /api/auth/login — Body: { identifier, password }
 * Password login for customers who set one. Identical error for unknown
 * account / wrong password / no-password-set, so nothing is leaked.
 */
export async function POST(req: NextRequest) {
  if (!rateLimit(`cust-login:${clientKey(req)}`, 8, 60_000)) {
    return NextResponse.json(
      { error: "Too many login attempts — please wait a minute and retry" },
      { status: 429 }
    );
  }

  let body: { identifier?: unknown; password?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const normalized = normalizeIdentifier(body.identifier);
  const password = typeof body.password === "string" ? body.password : "";
  if (!normalized || !password) {
    return NextResponse.json({ error: "Identifier and password are required" }, { status: 400 });
  }

  const customer = await getCustomerByIdentifier(normalized.identifier);
  if (!customer?.passwordHash || !verifyPassword(password, customer.passwordHash)) {
    return NextResponse.json(
      { error: "Incorrect details — try again or use an OTP" },
      { status: 401 }
    );
  }

  await updateCustomer(customer.id, { lastLoginAt: Date.now() });

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
