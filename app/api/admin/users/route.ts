import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

import { getCurrentAdmin } from "@/lib/auth/admin";
import { toPublicUser, validateAdminUserInput } from "@/lib/auth/admin-users";
import { hashPassword } from "@/lib/auth/password";
import { audit, createAdminUser, getAdminUserByEmail, listAdminUsers } from "@/lib/db";

/** GET /api/admin/users — list all admin users (super admin only). */
export async function GET() {
  const user = await getCurrentAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "super_admin") {
    return NextResponse.json(
      { error: "Only super admins can manage admin users" },
      { status: 403 }
    );
  }
  return NextResponse.json({ users: (await listAdminUsers()).map(toPublicUser) });
}

/** POST /api/admin/users — create an admin user (super admin only). */
export async function POST(req: NextRequest) {
  const user = await getCurrentAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "super_admin") {
    return NextResponse.json(
      { error: "Only super admins can manage admin users" },
      { status: 403 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = validateAdminUserInput(body, true);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  if (await getAdminUserByEmail(parsed.value.email)) {
    return NextResponse.json({ error: "An admin with that email already exists" }, { status: 409 });
  }

  const now = Date.now();
  const newUser = {
    id: `usr_${crypto.randomBytes(6).toString("hex")}`,
    name: parsed.value.name,
    email: parsed.value.email,
    passwordHash: hashPassword(parsed.value.password!),
    role: parsed.value.role,
    permissions: parsed.value.permissions,
    createdAt: now,
    updatedAt: now,
  };
  await createAdminUser(newUser);
  await audit(
    "user.create",
    "admin_user",
    newUser.id,
    `Created ${newUser.role} "${newUser.name}" (${newUser.email})`
  );
  return NextResponse.json({ user: toPublicUser(newUser) }, { status: 201 });
}
