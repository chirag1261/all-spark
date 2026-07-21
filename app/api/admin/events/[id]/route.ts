import { NextRequest, NextResponse } from "next/server";

import { getCurrentAdmin, hasPermission } from "@/lib/auth/admin";
import { audit, deleteEvent, getBookedSeats, getEvent, updateEvent } from "@/lib/db";
import { isValidSeatId, validateEventInput } from "@/lib/domain/events";

/** GET /api/admin/events/[id] */
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/admin/events/[id]">) {
  const user = await getCurrentAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(user, "events")) {
    return NextResponse.json({ error: "Missing events permission" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const event = await getEvent(id);
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  return NextResponse.json({ event });
}

/** PUT /api/admin/events/[id] — full update of an event. */
export async function PUT(req: NextRequest, ctx: RouteContext<"/api/admin/events/[id]">) {
  const user = await getCurrentAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(user, "events")) {
    return NextResponse.json({ error: "Missing events permission" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const existing = await getEvent(id);
  if (!existing) return NextResponse.json({ error: "Event not found" }, { status: 404 });

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

  // Shrinking the seat map must never orphan already-sold seats.
  const booked = await getBookedSeats(id);
  if (booked.length > 0) {
    const draft = { ...existing, ...parsed.value };
    const orphaned = booked.filter((s) => !isValidSeatId(draft, s));
    if (orphaned.length > 0) {
      return NextResponse.json(
        { error: `Layout change would remove already-booked seats: ${orphaned.join(", ")}` },
        { status: 409 }
      );
    }
    // A sold seat can't be pulled off sale by blocking it.
    const clash = parsed.value.blockedSeats.filter((s) => booked.includes(s));
    if (clash.length > 0) {
      return NextResponse.json(
        { error: `Cannot block seats that are already sold: ${clash.join(", ")}` },
        { status: 409 }
      );
    }
  }

  const event = await updateEvent(id, parsed.value);
  await audit("event.update", "event", id, `Updated "${parsed.value.title}"`);
  return NextResponse.json({ event });
}

/** DELETE /api/admin/events/[id] — blocked while confirmed bookings exist. */
export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/admin/events/[id]">) {
  const user = await getCurrentAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(user, "events")) {
    return NextResponse.json({ error: "Missing events permission" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const existing = await getEvent(id);
  if (!existing) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  const result = await deleteEvent(id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 409 });
  await audit("event.delete", "event", id, `Deleted "${existing.title}"`);
  return NextResponse.json({ deleted: true });
}
