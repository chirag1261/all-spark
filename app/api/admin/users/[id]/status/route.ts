import { NextRequest, NextResponse } from "next/server";

import { getCurrentAdmin } from "@/lib/auth/admin";
import { toPublicUser } from "@/lib/auth/admin-users";
import { audit, countActiveSuperAdmins, getAdminUserById, setAdminUserActive } from "@/lib/db";
import { logger } from "@/lib/logger";

/**
 * POST /api/admin/users/[id]/status — Body: { active: boolean }
 * Deactivate or reactivate an admin account (super admin only). A deactivated
 * account can't sign in and is logged out everywhere on its next request.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  if (user.role !== "super_admin") {
    logger.be.warn("Admin user status change denied — not a super admin", { userId: user.id, id });
    return NextResponse.json(
      { error: "Only super admins can manage admin users" },
      { status: 403 }
    );
  }

  let body: { active?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (typeof body.active !== "boolean") {
    return NextResponse.json({ error: "active must be a boolean" }, { status: 400 });
  }
  const active = body.active;

  const target = await getAdminUserById(id);
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  if (!active) {
    if (target.id === user.id) {
      logger.be.warn("Admin user deactivate blocked — self-deactivate attempt", { id });
      return NextResponse.json(
        { error: "You can't deactivate your own account — ask another super admin" },
        { status: 400 }
      );
    }
    // Never lock the system out of its last usable super admin.
    if (target.role === "super_admin" && target.active && (await countActiveSuperAdmins()) <= 1) {
      logger.be.warn("Admin user deactivate blocked — last active super admin", { id });
      return NextResponse.json(
        { error: "Cannot deactivate the last active super admin" },
        { status: 409 }
      );
    }
  }

  let updated;
  try {
    updated = await setAdminUserActive(id, active);
  } catch (err) {
    logger.be.error("Admin user status change failed", { id, err: String(err) });
    return NextResponse.json({ error: "Could not update the admin user" }, { status: 500 });
  }
  await audit(
    active ? "user.activate" : "user.deactivate",
    "admin_user",
    id,
    `${active ? "Activated" : "Deactivated"} ${target.role} "${target.name}" (${target.email})`
  );
  return NextResponse.json({ user: toPublicUser(updated!) });
}
