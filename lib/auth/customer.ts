import crypto from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { sessionSecret } from "@/lib/auth/secret";
import { getCustomerById } from "@/lib/db";
import { Customer, OtpChannel } from "@/types";

/**
 * Customer (public site) auth — completely separate from admin auth: its own
 * cookie, so a customer session can never be confused for an admin one.
 * Sessions are HMAC-signed "custId.expiry.sig" cookies, re-resolved against
 * the live customer record on every request.
 */

export const CUSTOMER_COOKIE = "customer_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const CUSTOMER_SESSION_MAX_AGE = SESSION_TTL_MS / 1000;

function sign(payload: string): string {
  return crypto.createHmac("sha256", sessionSecret()).update(payload).digest("hex");
}

export function createCustomerSessionToken(customerId: string): string {
  const exp = String(Date.now() + SESSION_TTL_MS);
  const payload = `${customerId}.${exp}`;
  return `${payload}.${sign(payload)}`;
}

function verifyToken(token: string | undefined): { customerId: string } | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [customerId, exp, sig] = parts;
  if (!customerId || !exp || !sig) return null;
  if (Number(exp) < Date.now()) return null;
  const expected = sign(`${customerId}.${exp}`);
  const a = Buffer.from(sig, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return { customerId };
}

export async function getCurrentCustomer(): Promise<Customer | null> {
  const store = await cookies();
  const session = verifyToken(store.get(CUSTOMER_COOKIE)?.value);
  if (!session) return null;
  return (await getCustomerById(session.customerId)) ?? null;
}

/** Page guard — bounces to /login carrying a safe return path. */
export async function requireCustomerPage(next: string): Promise<Customer> {
  const customer = await getCurrentCustomer();
  if (!customer) redirect(`/login?next=${encodeURIComponent(sanitizeNextPath(next))}`);
  return customer;
}

/** Only same-origin relative paths are allowed as post-login redirects. */
export function sanitizeNextPath(next: unknown): string {
  if (typeof next !== "string") return "/";
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return "/";
  return next;
}

// ---------- Identifier normalization ----------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Classifies raw input as an email or a phone number and normalizes it:
 * emails are lowercased; phones become +<country><digits> (10-digit inputs
 * are treated as Indian numbers). Returns null for anything else.
 */
export function normalizeIdentifier(
  raw: unknown
): { identifier: string; channel: OtpChannel } | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 254) return null;

  if (trimmed.includes("@")) {
    const email = trimmed.toLowerCase();
    return EMAIL_RE.test(email) ? { identifier: email, channel: "email" } : null;
  }

  const digits = trimmed.replace(/[\s()-]/g, "");
  if (/^\+?[0-9]{8,15}$/.test(digits)) {
    const phone = digits.startsWith("+")
      ? digits
      : digits.length === 10
        ? `+91${digits}`
        : `+${digits}`;
    return { identifier: phone, channel: "phone" };
  }
  return null;
}
