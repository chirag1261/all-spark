import { NextRequest, NextResponse } from "next/server";

import { getCurrentAdmin, hasPermission } from "@/lib/auth/admin";
import { audit, getBooking, releaseSeats, saveBooking } from "@/lib/db";
import { logger } from "@/lib/logger";

/**
 * POST /api/admin/cancel — Body: { orderId }
 * Cancels a PENDING booking (frees its seat locks). Paid bookings must go
 * through /api/admin/refund instead so the money is returned.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(user, "bookings")) {
    logger.be.warn("Booking cancel denied — missing permission", { userId: user.id });
    return NextResponse.json({ error: "Missing bookings permission" }, { status: 403 });
  }

  let body: { orderId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (typeof body.orderId !== "string" || !body.orderId) {
    return NextResponse.json({ error: "orderId is required" }, { status: 400 });
  }

  const booking = await getBooking(body.orderId);
  if (!booking) return NextResponse.json({ error: "Unknown order" }, { status: 404 });
  if (booking.status !== "PENDING") {
    logger.be.warn("Booking cancel blocked — not pending", {
      bookingId: booking.bookingId,
      status: booking.status,
    });
    return NextResponse.json(
      { error: "Only pending bookings can be cancelled — refund paid ones instead" },
      { status: 409 }
    );
  }

  try {
    await releaseSeats(booking.eventId, body.orderId);
    await saveBooking({ ...booking, status: "FAILED" });
  } catch (err) {
    logger.be.error("Booking cancel failed", { bookingId: booking.bookingId, err: String(err) });
    return NextResponse.json({ error: "Could not cancel the booking" }, { status: 500 });
  }
  await audit(
    "booking.cancel",
    "booking",
    booking.bookingId,
    `Cancelled pending booking for ${booking.customerEmail} (seats ${booking.seatIds.join(", ")})`
  );
  return NextResponse.json({ cancelled: true });
}
