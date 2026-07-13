import { NextRequest, NextResponse } from "next/server";
import { getBookedSeats, getLockedSeats } from "@/lib/store";

/** GET /api/seats?showId=... — current seat availability for a show. */
export async function GET(req: NextRequest) {
  const showId = req.nextUrl.searchParams.get("showId");
  if (!showId) {
    return NextResponse.json({ error: "showId is required" }, { status: 400 });
  }
  return NextResponse.json({
    booked: getBookedSeats(showId),
    locked: getLockedSeats(showId),
  });
}
