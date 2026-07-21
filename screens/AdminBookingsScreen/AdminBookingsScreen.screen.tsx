import { Download } from "lucide-react";
import Link from "next/link";

import AccessDenied from "@/components/AccessDenied";
import AdminHeader from "@/components/AdminHeader";
import CancelBookingButton from "@/components/CancelBookingButton";
import RefundButton from "@/components/RefundButton";
import { hasPermission, requireAdminPage } from "@/lib/auth/admin";
import { listBookings, listEvents, sweepStalePending } from "@/lib/db";
import { BookingStatus } from "@/types";
import { inr } from "@/utils";

const STATUS_TONES: Record<BookingStatus, string> = {
  CONFIRMED: "bg-emerald-500/15 text-emerald-400",
  PENDING: "bg-amber-500/15 text-amber-400",
  FAILED: "bg-zinc-500/15 text-zinc-400",
  REFUNDED: "bg-sky-500/15 text-sky-400",
};

interface AdminBookingsScreenProps {
  q?: string;
  eventId?: string;
  status?: string;
}

export async function AdminBookingsScreen({
  q = "",
  eventId = "",
  status = "",
}: AdminBookingsScreenProps) {
  const currentUser = await requireAdminPage();
  const canManageBookings = hasPermission(currentUser, "bookings");
  const canRefund = hasPermission(currentUser, "refunds");

  if (!canManageBookings) {
    return (
      <div className="min-h-screen text-zinc-100">
        <AdminHeader currentUser={currentUser} />
        <main className="max-w-6xl mx-auto px-4 py-8">
          <AccessDenied what="view bookings" />
        </main>
      </div>
    );
  }

  await sweepStalePending(); // reconcile abandoned checkouts before listing

  let bookings = await listBookings({ eventId: eventId || undefined, query: q || undefined });
  if (status) bookings = bookings.filter((b) => b.status === status);
  const events = await listEvents();
  const eventTitleById = new Map(events.map((e) => [e.id, e.title]));

  const exportParams = new URLSearchParams();
  if (q) exportParams.set("q", q);
  if (eventId) exportParams.set("eventId", eventId);
  if (status) exportParams.set("status", status);

  return (
    <div className="min-h-screen text-zinc-100">
      <AdminHeader currentUser={currentUser} />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <h1 className="text-2xl font-bold">Bookings</h1>
          <a
            href={`/api/admin/bookings/export?${exportParams}`}
            className="ml-auto inline-flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg px-4 py-2 font-semibold text-sm transition-colors"
          >
            <Download className="w-4 h-4" aria-hidden="true" /> Export CSV
          </a>
        </div>

        {/* Attendee search + filters (GET form keeps the URL shareable) */}
        <form method="GET" className="flex flex-col sm:flex-row gap-3 mb-6">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search attendee name, email, phone, booking or ticket ID…"
            className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-[#f84464]"
          />
          <select
            name="eventId"
            defaultValue={eventId}
            className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#f84464]"
          >
            <option value="">All events</option>
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title}
              </option>
            ))}
          </select>
          <select
            name="status"
            defaultValue={status}
            className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#f84464]"
          >
            <option value="">All statuses</option>
            {(["CONFIRMED", "PENDING", "FAILED", "REFUNDED"] as const).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="bg-[#f84464] hover:bg-[#e03a58] rounded-lg px-5 py-2.5 font-semibold text-sm transition-colors"
          >
            Search
          </button>
        </form>

        {bookings.length === 0 ? (
          <p className="text-zinc-500">No bookings found.</p>
        ) : (
          <div className="overflow-x-auto border border-zinc-800 rounded-xl">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-zinc-500 border-b border-zinc-800 bg-zinc-900/60">
                  <th className="px-4 py-3 font-medium">Attendee</th>
                  <th className="px-4 py-3 font-medium">Event</th>
                  <th className="px-4 py-3 font-medium">Seats</th>
                  <th className="px-4 py-3 font-medium">Ticket</th>
                  <th className="px-4 py-3 font-medium text-right">Amount</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Booked</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => (
                  <tr key={b.razorpayOrderId} className="border-b border-zinc-800/60 last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-medium">{b.attendeeName}</p>
                      <p className="text-xs text-zinc-500">
                        {b.customerEmail} · {b.customerPhone}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-zinc-400">
                      {eventTitleById.get(b.eventId) ?? b.eventId}
                    </td>
                    <td className="px-4 py-3">{b.seatIds.join(", ")}</td>
                    <td className="px-4 py-3">
                      {b.ticketId ? (
                        <Link
                          href={`/ticket/${b.ticketId}`}
                          className="font-mono text-xs text-[#f84464] hover:underline"
                        >
                          {b.ticketId}
                        </Link>
                      ) : (
                        <span className="text-zinc-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">{inr(b.amount)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block text-xs font-semibold px-2 py-0.5 rounded ${STATUS_TONES[b.status]}`}
                      >
                        {b.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-400 whitespace-nowrap text-xs">
                      {new Date(b.createdAt).toLocaleString("en-IN", {
                        timeZone: "Asia/Kolkata",
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </td>
                    <td className="px-4 py-3 text-right text-xs">
                      {b.status === "CONFIRMED" && canRefund && (
                        <RefundButton orderId={b.razorpayOrderId} amountInr={inr(b.amount)} />
                      )}
                      {b.status === "PENDING" && (
                        <CancelBookingButton orderId={b.razorpayOrderId} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-xs text-zinc-600 mt-4">
          {bookings.length} booking{bookings.length === 1 ? "" : "s"} shown. Refunds are full
          refunds via Razorpay and release the seats back to sale.
        </p>
      </main>
    </div>
  );
}
