import { NextRequest, NextResponse } from "next/server";

import { normalizeIdentifier } from "@/lib/auth/customer";
import { getCustomerByIdentifier } from "@/lib/db";
import { clientKey, rateLimit } from "@/lib/http/ratelimit";

/**
 * POST /api/auth/start — Body: { identifier }
 * First step of the login/signup wizard: classifies the identifier
 * (email vs phone) and says whether an account exists and how it can sign in.
 * Rate-limited: this necessarily reveals account existence (standard for
 * phone/email-first flows), so it must not be enumerable at speed.
 */
export async function POST(req: NextRequest) {
  if (!rateLimit(`auth-start:${clientKey(req)}`, 15, 60_000)) {
    return NextResponse.json(
      { error: "Too many attempts — try again in a minute" },
      { status: 429 }
    );
  }

  let body: { identifier?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const normalized = normalizeIdentifier(body.identifier);
  if (!normalized) {
    return NextResponse.json({ error: "Enter a valid email or phone number" }, { status: 400 });
  }

  const customer = await getCustomerByIdentifier(normalized.identifier);
  return NextResponse.json({
    identifier: normalized.identifier,
    channel: normalized.channel,
    exists: Boolean(customer),
  });
}
