import { NextResponse } from "next/server";

import { CUSTOMER_COOKIE } from "@/lib/auth/customer";

/** POST /api/auth/logout — clears the customer session cookie. */
export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(CUSTOMER_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
