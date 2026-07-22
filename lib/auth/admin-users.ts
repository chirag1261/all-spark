import { ADMIN_PERMISSIONS, AdminPermission, AdminRole, AdminUserPublic } from "@/types";

export interface AdminUserInput {
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  password?: unknown;
  role?: unknown;
  permissions?: unknown;
}

export interface ValidatedAdminUser {
  name: string;
  email: string;
  phone: string | null;
  password: string | null; // null when omitted on an update (keep existing hash)
  role: AdminRole;
  permissions: AdminPermission[];
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validates admin-user create/update input. `passwordRequired` is true for
 * create (every account needs a password) and false for update (omit to
 * keep the current password).
 */
export function validateAdminUserInput(
  body: AdminUserInput,
  passwordRequired: boolean
): { ok: true; value: ValidatedAdminUser } | { ok: false; error: string } {
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

  const name = str(body.name);
  if (!name) return { ok: false, error: "Name is required" };

  const email = str(body.email).toLowerCase();
  if (!email || !EMAIL_RE.test(email)) return { ok: false, error: "A valid email is required" };

  // Optional contact number — kept as-typed, lightly bounded. Not used for auth.
  const phoneRaw = str(body.phone);
  if (phoneRaw && !/^[+\d][\d\s-]{5,19}$/.test(phoneRaw)) {
    return { ok: false, error: "Enter a valid phone number" };
  }
  const phone = phoneRaw || null;

  const role = str(body.role);
  if (role !== "super_admin" && role !== "admin" && role !== "gate_controller") {
    return { ok: false, error: 'role must be "super_admin", "admin" or "gate_controller"' };
  }

  // Only regular admins carry a scoped permission list. Super admins have all;
  // gate controllers have none (scanner-only).
  let permissions: AdminPermission[] = [];
  if (role === "admin") {
    if (body.permissions !== undefined) {
      if (!Array.isArray(body.permissions)) {
        return { ok: false, error: "permissions must be an array" };
      }
      for (const p of body.permissions) {
        if (!ADMIN_PERMISSIONS.includes(p)) {
          return { ok: false, error: `Unknown permission "${p}"` };
        }
      }
      permissions = [...new Set(body.permissions as AdminPermission[])];
    }
  }
  // Super admins implicitly have every permission — don't persist a stale list.

  let password: string | null = null;
  if (body.password !== undefined && body.password !== "") {
    const raw = typeof body.password === "string" ? body.password : "";
    if (raw.length < 8) return { ok: false, error: "Password must be at least 8 characters" };
    password = raw;
  } else if (passwordRequired) {
    return { ok: false, error: "Password is required" };
  }

  return { ok: true, value: { name, email, phone, password, role, permissions } };
}

export function toPublicUser<T extends { passwordHash: string }>(user: T): Omit<T, "passwordHash"> {
  const clone: Partial<T> = { ...user };
  delete clone.passwordHash;
  return clone as Omit<T, "passwordHash">;
}

export type { AdminUserPublic };
