import { NextRequest, NextResponse } from "next/server";

import { getCurrentAdmin, hasPermission } from "@/lib/auth/admin";
import { audit, deleteOrganizer, getOrganizerById, updateOrganizer } from "@/lib/db";
import { validateOrganizerInput } from "@/lib/domain/organizers";
import { logger } from "@/lib/logger";
import { AdminUser } from "@/types";

async function requireOrganizerAdmin(): Promise<{ user?: AdminUser; error?: NextResponse }> {
  const user = await getCurrentAdmin();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!hasPermission(user, "organizers")) {
    logger.be.warn("Organizer action denied — missing permission", { userId: user.id });
    return {
      error: NextResponse.json({ error: "Not allowed to manage organizers" }, { status: 403 }),
    };
  }
  return { user };
}

/** PUT /api/admin/organizers/[id] */
export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireOrganizerAdmin();
  if (auth.error) return auth.error;
  const { id } = await ctx.params;
  const target = await getOrganizerById(id);
  if (!target) return NextResponse.json({ error: "Organizer not found" }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = validateOrganizerInput(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  let updated;
  try {
    updated = await updateOrganizer(id, parsed.value);
  } catch (err) {
    logger.be.error("Organizer update failed", { id, err: String(err) });
    return NextResponse.json({ error: "Could not update the organizer" }, { status: 500 });
  }
  await audit("organizer.update", "organizer", id, `Updated organizer "${updated!.name}"`);
  return NextResponse.json({ organizer: updated });
}

/** DELETE /api/admin/organizers/[id] */
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireOrganizerAdmin();
  if (auth.error) return auth.error;
  const { id } = await ctx.params;
  const target = await getOrganizerById(id);
  if (!target) return NextResponse.json({ error: "Organizer not found" }, { status: 404 });

  try {
    await deleteOrganizer(id);
  } catch (err) {
    logger.be.error("Organizer delete failed", { id, err: String(err) });
    return NextResponse.json({ error: "Could not delete the organizer" }, { status: 500 });
  }
  await audit("organizer.delete", "organizer", id, `Removed organizer "${target.name}"`);
  return NextResponse.json({ deleted: true });
}
