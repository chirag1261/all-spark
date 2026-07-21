import crypto from "crypto";

/**
 * Password hashing for admin accounts — scrypt (Node built-in, no extra
 * dependency) with a random salt per user. Stored as "saltHex:hashHex".
 * Kept dependency-free of db.ts/auth.ts so both can import it without a cycle.
 */

const KEY_LEN = 64;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, KEY_LEN);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  const actual = crypto.scryptSync(password, salt, KEY_LEN);
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}
