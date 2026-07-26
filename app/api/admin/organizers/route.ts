import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

import { getCurrentAdmin, hasPermission } from "@/lib/auth/admin";
import { audit, createOrganizer, listOrganizers } from "@/lib/db";
import { validateOrganizerInput } from "@/lib/domain/organizers";
import { logger } from "@/lib/logger";

/** GET /api/admin/organizers — list all organizers (any published state). */
export async function GET() {
  const user = await getCurrentAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(user, "organizers")) {
    return NextResponse.json({ error: "Not allowed to manage organizers" }, { status: 403 });
  }
  return NextResponse.json({ organizers: await listOrganizers() });
}

/** POST /api/admin/organizers — create an organizer. */
export async function POST(req: NextRequest) {
  const user = await getCurrentAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(user, "organizers")) {
    logger.be.warn("Organizer create denied — missing permission", { userId: user.id });
    return NextResponse.json({ error: "Not allowed to manage organizers" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = validateOrganizerInput(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const now = Date.now();
  const organizer = {
    id: `org_${crypto.randomBytes(6).toString("hex")}`,
    ...parsed.value,
    createdAt: now,
    updatedAt: now,
  };
  try {
    await createOrganizer(organizer);
  } catch (err) {
    logger.be.error("Organizer create failed", { name: organizer.name, err: String(err) });
    return NextResponse.json({ error: "Could not create the organizer" }, { status: 500 });
  }
  await audit("organizer.create", "organizer", organizer.id, `Added organizer "${organizer.name}"`);
  return NextResponse.json({ organizer }, { status: 201 });
}
