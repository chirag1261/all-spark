import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

import {
  confirmSeats,
  getBooking,
  getBookingByPaymentId,
  lockSeats,
  logPaymentEvent,
  releaseSeats,
  saveBooking,
  sweepStalePending,
  unbookSeats,
} from "@/lib/db";
import { ensureTicketsForBooking } from "@/lib/domain/tickets";
import { sendTicketEmail } from "@/lib/notifications/email";
import { sendTicketWhatsApp } from "@/lib/notifications/whatsapp";

/**
 * POST /api/webhooks/razorpay — the AUTHORITATIVE payment signal.
 *
 * The browser handler (/api/verify) is a fast path that can be lost if the tab
 * closes mid-payment; this webhook closes that gap. Configure it in the
 * Razorpay dashboard (Settings → Webhooks) pointing at this route with
 * RAZORPAY_WEBHOOK_SECRET, subscribing to payment.captured, payment.failed
 * and refund.processed.
 *
 * Idempotent by design: replays and out-of-order deliveries are no-ops.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  // Signature is computed over the RAW body — read text before parsing.
  const raw = await req.text();
  const signature = req.headers.get("x-razorpay-signature") ?? "";
  const expected = crypto.createHmac("sha256", secret).update(raw).digest("hex");
  const sigBuf = Buffer.from(signature, "utf8");
  const expBuf = Buffer.from(expected, "utf8");
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let payload: {
    event?: string;
    payload?: {
      payment?: { entity?: { id?: string; order_id?: string } };
      refund?: { entity?: { id?: string; payment_id?: string } };
    };
  };
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventType = payload.event ?? "unknown";
  await sweepStalePending();

  switch (eventType) {
    case "payment.captured": {
      const payment = payload.payload?.payment?.entity;
      const orderId = payment?.order_id;
      const paymentId = payment?.id;
      if (!orderId || !paymentId) break;

      const booking = await getBooking(orderId);
      if (!booking) {
        await logPaymentEvent(eventType, "unknown order", { orderId, paymentId });
        break;
      }
      if (booking.status === "CONFIRMED" || booking.status === "REFUNDED") {
        await logPaymentEvent(eventType, "already processed", { orderId, paymentId });
        break;
      }

      // The booking may have been marked FAILED (dismissed modal / lost tab)
      // and its lock released — money is authoritative, so re-take the seats.
      const relock = await lockSeats(booking.eventId, booking.seatIds, orderId);
      if (!relock.ok) {
        // Seats were re-sold in the gap (slow capture). Needs a manual refund.
        await logPaymentEvent(
          eventType,
          `CONFLICT — seats re-sold: ${relock.conflicts.join(",")}`,
          {
            orderId,
            paymentId,
          }
        );
        break;
      }
      await confirmSeats(booking.eventId, booking.seatIds, orderId);

      const confirmed = {
        ...booking,
        status: "CONFIRMED" as const,
        razorpayPaymentId: paymentId,
      };
      const tickets = await ensureTicketsForBooking(confirmed);
      confirmed.ticketId = tickets[0]?.ticketId; // legacy pointer to the first ticket
      await saveBooking(confirmed);

      const origin = process.env.NEXT_PUBLIC_BASE_URL ?? req.nextUrl.origin;
      if (!booking.emailSent) {
        const email = await sendTicketEmail(confirmed, tickets, origin);
        confirmed.emailSent = email.sent;
      }
      if (!booking.whatsappSent) {
        const whatsapp = await sendTicketWhatsApp(confirmed, tickets, origin);
        confirmed.whatsappSent = whatsapp.sent;
      }
      await saveBooking(confirmed);
      await logPaymentEvent(eventType, "confirmed", { orderId, paymentId });
      break;
    }

    case "payment.failed": {
      const payment = payload.payload?.payment?.entity;
      const orderId = payment?.order_id;
      if (!orderId) break;
      const booking = await getBooking(orderId);
      if (booking && booking.status === "PENDING") {
        await releaseSeats(booking.eventId, orderId);
        await saveBooking({ ...booking, status: "FAILED" });
        await logPaymentEvent(eventType, "released", { orderId, paymentId: payment?.id });
      } else {
        await logPaymentEvent(eventType, "no-op", { orderId, paymentId: payment?.id });
      }
      break;
    }

    case "refund.processed": {
      const refund = payload.payload?.refund?.entity;
      const paymentId = refund?.payment_id;
      if (!paymentId) break;
      const booking = await getBookingByPaymentId(paymentId);
      if (booking && booking.status !== "REFUNDED") {
        await saveBooking({ ...booking, status: "REFUNDED", razorpayRefundId: refund?.id });
        await unbookSeats(booking.eventId, booking.seatIds);
        await logPaymentEvent(eventType, "refunded", {
          orderId: booking.razorpayOrderId,
          paymentId,
        });
      } else {
        await logPaymentEvent(eventType, "no-op", { paymentId });
      }
      break;
    }

    default:
      await logPaymentEvent(eventType, "ignored");
  }

  // Always 200 for verified deliveries so Razorpay stops retrying.
  return NextResponse.json({ received: true });
}
