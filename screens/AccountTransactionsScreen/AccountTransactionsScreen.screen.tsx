import { Undo2 } from "lucide-react";

import AccountShell from "@/components/AccountShell";
import { requireCustomerPage } from "@/lib/auth/customer";
import { listBookingsForCustomer, listEvents } from "@/lib/db";
import { BOOKING_STATUS_LABEL, BOOKING_STATUS_TONE, inr } from "@/utils";

export async function AccountTransactionsScreen() {
  const customer = await requireCustomerPage("/account/transactions");
  const bookings = await listBookingsForCustomer(customer.id);
  const eventTitleById = new Map((await listEvents()).map((e) => [e.id, e.title]));

  return (
    <AccountShell active="/account/transactions">
      <h1 className="text-2xl font-bold mb-6">My Transactions</h1>
      {bookings.length === 0 ? (
        <p className="text-zinc-500 py-16 text-center">No transactions yet.</p>
      ) : (
        <div className="overflow-x-auto border border-zinc-800 rounded-xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-zinc-500 border-b border-zinc-800 bg-zinc-900/60">
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Event</th>
                <th className="px-4 py-3 font-medium">Reference</th>
                <th className="px-4 py-3 font-medium text-right">Amount</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b.razorpayOrderId} className="border-b border-zinc-800/60 last:border-0">
                  <td className="px-4 py-3 text-zinc-400 whitespace-nowrap text-xs">
                    {new Date(b.createdAt).toLocaleString("en-IN", {
                      timeZone: "Asia/Kolkata",
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </td>
                  <td className="px-4 py-3 wrap-break-word">
                    {eventTitleById.get(b.eventId) ?? b.eventId}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-mono text-xs">{b.bookingId}</p>
                    {b.razorpayPaymentId && (
                      <p className="font-mono text-[11px] text-zinc-500">{b.razorpayPaymentId}</p>
                    )}
                    {b.razorpayRefundId && (
                      <p className="flex items-center gap-1 font-mono text-[11px] text-sky-400">
                        <Undo2 className="w-3 h-3" aria-hidden="true" />
                        {b.razorpayRefundId}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">{inr(b.amount)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block text-xs font-semibold px-2 py-0.5 rounded ${BOOKING_STATUS_TONE[b.status]}`}
                    >
                      {BOOKING_STATUS_LABEL[b.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AccountShell>
  );
}
