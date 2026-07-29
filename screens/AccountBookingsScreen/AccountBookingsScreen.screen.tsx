import { Ticket } from "lucide-react";
import Link from "next/link";

import AccountShell from "@/components/AccountShell";
import { requireCustomerPage } from "@/lib/auth/customer";
import { listBookingsForCustomer, listEvents, listTicketsForBooking } from "@/lib/db";
import { BOOKING_STATUS_LABEL, BOOKING_STATUS_TONE, formatDateIST, inr } from "@/utils";

export async function AccountBookingsScreen() {
  const customer = await requireCustomerPage("/account/bookings");
  const bookings = await listBookingsForCustomer(customer.id);
  const eventById = new Map((await listEvents()).map((e) => [e.id, e]));
  const ticketsByBooking = new Map(
    await Promise.all(
      bookings
        .filter((b) => b.status === "CONFIRMED")
        .map(async (b) => [b.bookingId, await listTicketsForBooking(b.bookingId)] as const)
    )
  );

  return (
    <AccountShell active="/account/bookings">
      <h1 className="text-2xl font-bold mb-6">My Bookings</h1>
      {bookings.length === 0 ? (
        <Empty label="No bookings yet." cta="Browse events" href="/" />
      ) : (
        <div className="space-y-4">
          {bookings.map((b) => {
            const event = eventById.get(b.eventId);
            const tickets = ticketsByBooking.get(b.bookingId) ?? [];
            return (
              <div
                key={b.razorpayOrderId}
                className="bg-white border border-slate-200 rounded-2xl p-5"
              >
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold wrap-break-word">{event?.title ?? b.eventId}</p>
                    <p className="text-sm text-slate-600">
                      {event
                        ? `${formatDateIST(event.startsAt)} · ${event.venue}, ${event.city}`
                        : ""}
                    </p>
                    <p className="text-sm text-slate-500 mt-1">
                      Seats {b.seatIds.join(", ")} · {inr(b.amount)} ·{" "}
                      <span className="font-mono text-xs">{b.bookingId}</span>
                    </p>
                  </div>
                  <span
                    className={`shrink-0 inline-block text-xs font-semibold px-2 py-0.5 rounded ${BOOKING_STATUS_TONE[b.status]}`}
                  >
                    {BOOKING_STATUS_LABEL[b.status]}
                  </span>
                </div>
                {tickets.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-4">
                    {tickets.map((t) => (
                      <Link
                        key={t.ticketId}
                        href={`/ticket/${t.ticketId}`}
                        className="inline-flex items-center gap-1.5 text-xs bg-slate-100 hover:bg-slate-200 rounded-lg px-3 py-1.5 transition-colors"
                      >
                        <Ticket className="w-3.5 h-3.5" aria-hidden="true" /> {t.attendeeName} ·{" "}
                        {t.seatId}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </AccountShell>
  );
}

function Empty({ label, cta, href }: { label: string; cta: string; href: string }) {
  return (
    <div className="text-center py-16">
      <p className="text-slate-500 mb-4">{label}</p>
      <Link
        href={href}
        className="inline-block bg-linear-to-r from-[#D4AF37] to-[#E6C35C] hover:brightness-105 text-[#081A3A] rounded-full px-5 py-2.5 font-semibold text-sm transition-all"
      >
        {cta}
      </Link>
    </div>
  );
}
