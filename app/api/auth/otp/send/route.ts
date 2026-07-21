import { NextRequest, NextResponse } from "next/server";

import { normalizeIdentifier } from "@/lib/auth/customer";
import { issueOtp } from "@/lib/auth/otp";
import { clientKey, rateLimit } from "@/lib/http/ratelimit";

/**
 * POST /api/auth/otp/send — Body: { identifier }
 * Issues a 6-digit OTP to the email/phone. The code is delivered out-of-band
 * only (email/SMS, or the server console in dev) — never in the response.
 * Dual rate limits: per client (spam) and per identifier (bombing a victim).
 */
export async function POST(req: NextRequest) {
  if (!rateLimit(`otp-send-ip:${clientKey(req)}`, 8, 10 * 60_000)) {
    return NextResponse.json({ error: "Too many OTP requests — try again later" }, { status: 429 });
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

  if (!rateLimit(`otp-send-id:${normalized.identifier}`, 3, 10 * 60_000)) {
    return NextResponse.json(
      { error: "Too many codes sent to this contact — try again in 10 minutes" },
      { status: 429 }
    );
  }

  const result = await issueOtp(normalized.identifier, normalized.channel);
  if (!result.sent) {
    return NextResponse.json({ error: "Could not deliver the code — try again" }, { status: 502 });
  }
  return NextResponse.json({ sent: true, channel: normalized.channel });
}
