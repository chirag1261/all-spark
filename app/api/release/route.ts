import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

import { getBooking, releaseSeats, saveBooking } from "@/lib/db";
import { releaseToken } from "@/lib/domain/tickets";

/**
 * POST /api/release
 * Body: { orderId, releaseToken }
 *
 * Frees locked seats when the user dismisses the Razorpay checkout without
 * paying. The releaseToken (returned only to the order's creator) stops
 * third parties from freeing someone else's held seats by guessing orderIds.
 * Confirmed bookings are never released from here.
 */
export async function POST(req: NextRequest) {
  let body: { orderId?: unknown; releaseToken?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.orderId !== "string" || !body.orderId) {
    return NextResponse.json({ error: "orderId is required" }, { status: 400 });
  }

  const expected = releaseToken(body.orderId);
  const provided = typeof body.releaseToken === "string" ? body.releaseToken : "";
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "Invalid release token" }, { status: 403 });
  }

  const booking = await getBooking(body.orderId);
  if (!booking) {
    return NextResponse.json({ error: "Unknown order" }, { status: 404 });
  }
  if (booking.status === "CONFIRMED") {
    return NextResponse.json({ error: "Booking already confirmed" }, { status: 409 });
  }

  await releaseSeats(booking.eventId, body.orderId);
  await saveBooking({ ...booking, status: "FAILED" });
  return NextResponse.json({ released: true });
}
