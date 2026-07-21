import { NextRequest, NextResponse } from "next/server";

import {
  ADMIN_COOKIE,
  adminConfigured,
  createSessionToken,
  verifyPassword,
} from "@/lib/auth/admin";
import { getAdminUserByEmail, updateAdminUser } from "@/lib/db";
import { clientKey, rateLimit } from "@/lib/http/ratelimit";

/** POST /api/admin/login — Body: { email, password } */
export async function POST(req: NextRequest) {
  if (!(await adminConfigured())) {
    return NextResponse.json(
      {
        error: "No admin account exists yet. Set ADMIN_EMAIL and ADMIN_PASSWORD to bootstrap one.",
      },
      { status: 500 }
    );
  }

  // Protect the password store from brute force — a real secret is worth
  // rate-limiting more tightly than the general API traffic.
  if (!rateLimit(`login:${clientKey(req)}`, 8, 60_000)) {
    return NextResponse.json(
      { error: "Too many login attempts — please wait a minute and retry" },
      { status: 429 }
    );
  }

  let body: { email?: unknown; password?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  const user = await getAdminUserByEmail(email);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    // Same message for unknown email and wrong password — don't leak which.
    return NextResponse.json({ error: "Incorrect email or password" }, { status: 401 });
  }

  await updateAdminUser(user.id, { lastLoginAt: Date.now() });

  const res = NextResponse.json({
    ok: true,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
  res.cookies.set(ADMIN_COOKIE, createSessionToken(user.id), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 12 * 60 * 60,
  });
  return res;
}
