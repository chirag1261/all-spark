import Link from "next/link";

import AccountShell from "@/components/AccountShell";
import { requireCustomerPage } from "@/lib/auth/customer";
import { listEvents, listTicketsForCustomer } from "@/lib/db";
import { formatDateIST } from "@/utils";

export async function AccountTicketsScreen() {
  const customer = await requireCustomerPage("/account/tickets");
  const tickets = await listTicketsForCustomer(customer.id);
  const eventById = new Map((await listEvents()).map((e) => [e.id, e]));

  return (
    <AccountShell active="/account/tickets">
      <h1 className="text-2xl font-bold mb-6">My Tickets</h1>
      {tickets.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-slate-500 mb-4">No tickets yet — they appear here after a booking.</p>
          <Link
            href="/"
            className="inline-block bg-[#1d4ed8] hover:bg-[#1e40af] text-white rounded-lg px-5 py-2.5 font-semibold text-sm transition-colors"
          >
            Browse events
          </Link>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {tickets.map((t) => {
            const event = eventById.get(t.eventId);
            return (
              <Link
                key={t.ticketId}
                href={`/ticket/${t.ticketId}`}
                className="bg-white border border-slate-200 hover:border-[#1d4ed8]/60 rounded-2xl p-5 transition-colors"
              >
                <p className="font-bold wrap-break-word">{event?.title ?? t.eventId}</p>
                <p className="text-sm text-slate-600">
                  {event ? formatDateIST(event.startsAt) : ""}
                </p>
                <div className="flex items-center justify-between mt-3 text-sm">
                  <span className="wrap-break-word min-w-0">
                    {t.attendeeName} · Seat <strong>{t.seatId}</strong>
                  </span>
                  <span className="shrink-0 font-mono text-xs text-[#1d4ed8]">{t.ticketId}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </AccountShell>
  );
}
