import { NextRequest, NextResponse } from "next/server";

import { getCurrentAdmin } from "@/lib/auth/admin";
import { toPublicUser, validateAdminUserInput } from "@/lib/auth/admin-users";
import { hashPassword } from "@/lib/auth/password";
import {
  audit,
  countSuperAdmins,
  deleteAdminUser,
  getAdminUserByEmail,
  getAdminUserById,
  updateAdminUser,
} from "@/lib/db";
import { AdminUser } from "@/types";

async function requireSuperAdmin(): Promise<{ user?: AdminUser; error?: NextResponse }> {
  const user = await getCurrentAdmin();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (user.role !== "super_admin") {
    return {
      error: NextResponse.json(
        { error: "Only super admins can manage admin users" },
        { status: 403 }
      ),
    };
  }
  return { user };
}

/** GET /api/admin/users/[id] */
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/admin/users/[id]">) {
  const auth = await requireSuperAdmin();
  if (auth.error) return auth.error;
  const { id } = await ctx.params;
  const target = await getAdminUserById(id);
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });
  return NextResponse.json({ user: toPublicUser(target) });
}

/** PUT /api/admin/users/[id] — update name/email/role/permissions, optionally reset password. */
export async function PUT(req: NextRequest, ctx: RouteContext<"/api/admin/users/[id]">) {
  const auth = await requireSuperAdmin();
  if (auth.error) return auth.error;
  const { id } = await ctx.params;
  const target = await getAdminUserById(id);
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = validateAdminUserInput(body, false);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const emailOwner = await getAdminUserByEmail(parsed.value.email);
  if (emailOwner && emailOwner.id !== id) {
    return NextResponse.json({ error: "An admin with that email already exists" }, { status: 409 });
  }

  // The system must always retain at least one super admin.
  if (
    target.role === "super_admin" &&
    parsed.value.role !== "super_admin" &&
    (await countSuperAdmins()) <= 1
  ) {
    return NextResponse.json(
      { error: "Cannot demote the last super admin — promote another admin first" },
      { status: 409 }
    );
  }

  const updated = await updateAdminUser(id, {
    name: parsed.value.name,
    email: parsed.value.email,
    phone: parsed.value.phone,
    role: parsed.value.role,
    permissions: parsed.value.permissions,
    ...(parsed.value.password ? { passwordHash: hashPassword(parsed.value.password) } : {}),
  });
  await audit(
    "user.update",
    "admin_user",
    id,
    `Updated ${updated!.role} "${updated!.name}" (${updated!.email})${
      parsed.value.password ? " — password reset" : ""
    }`
  );
  return NextResponse.json({ user: toPublicUser(updated!) });
}

/** DELETE /api/admin/users/[id] */
export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/admin/users/[id]">) {
  const auth = await requireSuperAdmin();
  if (auth.error) return auth.error;
  const { id } = await ctx.params;
  const target = await getAdminUserById(id);
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  if (target.id === auth.user!.id) {
    return NextResponse.json(
      { error: "You can't delete your own account — ask another super admin" },
      { status: 400 }
    );
  }
  if (target.role === "super_admin" && (await countSuperAdmins()) <= 1) {
    return NextResponse.json({ error: "Cannot delete the last super admin" }, { status: 409 });
  }

  await deleteAdminUser(id);
  await audit(
    "user.delete",
    "admin_user",
    id,
    `Deleted ${target.role} "${target.name}" (${target.email})`
  );
  return NextResponse.json({ deleted: true });
}
