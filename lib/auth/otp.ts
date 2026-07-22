import crypto from "crypto";

import { sessionSecret } from "@/lib/auth/secret";
import {
  bumpOtpAttempts,
  consumeOtpChallenge,
  createOtpChallenge,
  getLiveOtpChallenge,
} from "@/lib/db";
import { sendOtpEmail } from "@/lib/notifications/email";
import { sendSms } from "@/lib/notifications/sms";
import { OtpChannel } from "@/types";

/**
 * OTP issue/verify. Security properties:
 * - 6 digits from crypto.randomInt — never Math.random.
 * - Only an HMAC of the code is stored; a DB leak doesn't leak live codes.
 * - 5-minute expiry, single use, max 5 verify attempts, then dead.
 * - Issuing a new code invalidates all previous ones for that identifier.
 * - The code is never present in any API response (email/SMS/console only).
 */

const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function hashCode(identifier: string, code: string): string {
  return crypto.createHmac("sha256", sessionSecret()).update(`${identifier}:${code}`).digest("hex");
}

export async function issueOtp(
  identifier: string,
  channel: OtpChannel
): Promise<{ sent: boolean }> {
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");

  await createOtpChallenge({
    id: `otp_${crypto.randomBytes(6).toString("hex")}`,
    identifier,
    channel,
    codeHash: hashCode(identifier, code),
    expiresAt: Date.now() + OTP_TTL_MS,
    attempts: 0,
    consumed: false,
    createdAt: Date.now(),
  });

  if (channel === "email") {
    return sendOtpEmail(identifier, code);
  }
  return sendSms(
    identifier,
    `${code} is your Utsav Events verification code. Valid for 5 minutes.`
  );
}

export type OtpVerifyResult = "ok" | "invalid" | "expired" | "locked";

export async function verifyOtp(identifier: string, code: string): Promise<OtpVerifyResult> {
  const challenge = await getLiveOtpChallenge(identifier);
  if (!challenge) return "expired";

  const attempts = await bumpOtpAttempts(challenge.id);
  if (attempts > MAX_ATTEMPTS) {
    await consumeOtpChallenge(challenge.id);
    return "locked";
  }

  const expected = Buffer.from(challenge.codeHash, "utf8");
  const actual = Buffer.from(hashCode(identifier, code), "utf8");
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
    return "invalid";
  }

  await consumeOtpChallenge(challenge.id); // single use
  return "ok";
}
