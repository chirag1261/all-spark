import crypto from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { verifyPassword } from "@/lib/auth/password";
import { sessionSecret } from "@/lib/auth/secret";
import { getAdminUserById, listAdminUsers } from "@/lib/db";
import { AdminPermission, AdminUser } from "@/types";

/**
 * Multi-user admin auth. Each admin user has a role (super_admin | admin)
 * and, for non-super-admins, a set of scoped permissions. Sessions are
 * HttpOnly cookies holding "userId.expiry.HMAC(userId|expiry)" — signed so
 * they can't be forged, and re-resolved against the live user record on
 * every request so a deleted/edited user's access changes immediately.
 */

export const ADMIN_COOKIE = "admin_session";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

function sign(payload: string): string {
  return crypto.createHmac("sha256", sessionSecret()).update(payload).digest("hex");
}

/** True once at least one admin account exists (login is otherwise impossible). */
export async function adminConfigured(): Promise<boolean> {
  return (await listAdminUsers()).length > 0;
}

export function createSessionToken(userId: string): string {
  const exp = String(Date.now() + SESSION_TTL_MS);
  const payload = `${userId}.${exp}`;
  return `${payload}.${sign(payload)}`;
}

function verifySessionToken(token: string | undefined): { userId: string } | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userId, exp, sig] = parts;
  if (!userId || !exp || !sig) return null;
  if (Number(exp) < Date.now()) return null;
  const expected = sign(`${userId}.${exp}`);
  const a = Buffer.from(sig, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return { userId };
}

/** The authenticated admin user for this request, or null. Re-reads the
 *  live user record so edits/deletes/permission changes apply immediately. */
export async function getCurrentAdmin(): Promise<AdminUser | null> {
  const store = await cookies();
  const session = verifySessionToken(store.get(ADMIN_COOKIE)?.value);
  if (!session) return null;
  return (await getAdminUserById(session.userId)) ?? null;
}

export function hasPermission(user: AdminUser, permission: AdminPermission): boolean {
  return user.role === "super_admin" || user.permissions.includes(permission);
}

/** Page guard: bounces unauthenticated visitors to login, otherwise returns the user. */
export async function requireAdminPage(): Promise<AdminUser> {
  const user = await getCurrentAdmin();
  if (!user) redirect("/admin/login");
  return user;
}

export { verifyPassword };
