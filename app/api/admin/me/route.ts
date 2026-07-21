import { NextResponse } from "next/server";

import { getCurrentAdmin } from "@/lib/auth/admin";

/** GET /api/admin/me — the current admin's public profile (no password hash). */
export async function GET() {
  const user = await getCurrentAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      permissions: user.permissions,
    },
  });
}
