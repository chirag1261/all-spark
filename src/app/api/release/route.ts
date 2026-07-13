import { NextRequest, NextResponse } from "next/server";
import { getBooking, releaseSeats, saveBooking } from "@/lib/store";

/**
 * POST /api/release
 * Body: { orderId }
 *
 * Frees locked seats when the user dismisses the Razorpay checkout without
 * paying. Confirmed bookings are never released from here.
 */
export async function POST(req: NextRequest) {
  let body: { orderId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.orderId !== "string" || !body.orderId) {
    return NextResponse.json({ error: "orderId is required" }, { status: 400 });
  }

  const booking = getBooking(body.orderId);
  if (!booking) {
    return NextResponse.json({ error: "Unknown order" }, { status: 404 });
  }
  if (booking.status === "CONFIRMED") {
    return NextResponse.json({ error: "Booking already confirmed" }, { status: 409 });
  }

  releaseSeats(booking.showId, body.orderId);
  saveBooking({ ...booking, status: "FAILED" });
  return NextResponse.json({ released: true });
}
