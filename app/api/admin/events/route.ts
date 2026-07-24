import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

import { getCurrentAdmin, hasPermission } from "@/lib/auth/admin";
import { audit, createEvent, listEvents } from "@/lib/db";
import { posterForIndex, validateEventInput } from "@/lib/domain/events";
import { logger } from "@/lib/logger";

/** GET /api/admin/events — all events (including unpublished). */
export async function GET() {
  const user = await getCurrentAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(user, "events")) {
    return NextResponse.json({ error: "Missing events permission" }, { status: 403 });
  }
  return NextResponse.json({ events: await listEvents() });
}

/** POST /api/admin/events — create an event. */
export async function POST(req: NextRequest) {
  const user = await getCurrentAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(user, "events")) {
    logger.be.warn("Event create denied — missing permission", { userId: user.id });
    return NextResponse.json({ error: "Missing events permission" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = validateEventInput(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const now = Date.now();
  const event = {
    ...parsed.value,
    id: `evt_${crypto.randomBytes(6).toString("hex")}`,
    poster: posterForIndex((await listEvents()).length),
    createdAt: now,
    updatedAt: now,
  };
  try {
    await createEvent(event);
  } catch (err) {
    logger.be.error("Event create failed", { title: event.title, err: String(err) });
    return NextResponse.json({ error: "Could not create the event" }, { status: 500 });
  }
  await audit("event.create", "event", event.id, `Created "${event.title}"`);
  return NextResponse.json({ event }, { status: 201 });
}
