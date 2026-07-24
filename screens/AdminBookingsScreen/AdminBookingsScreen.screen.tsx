import { Download } from "lucide-react";
import Link from "next/link";

import AccessDenied from "@/components/AccessDenied";
import AdminShell from "@/components/AdminShell";
import CancelBookingButton from "@/components/CancelBookingButton";
import RefundButton from "@/components/RefundButton";
import { hasPermission, requireDashboardPage } from "@/lib/auth/admin";
import { listBookings, listEvents, sweepStalePending } from "@/lib/db";
import { BookingStatus } from "@/types";
import { inr } from "@/utils";

const STATUS_TONES: Record<BookingStatus, string> = {
  CONFIRMED: "bg-emerald-50 text-emerald-700",
  PENDING: "bg-amber-50 text-amber-700",
  FAILED: "bg-slate-100 text-slate-600",
  REFUNDED: "bg-sky-50 text-sky-700",
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
  const currentUser = await requireDashboardPage();
  const canManageBookings = hasPermission(currentUser, "bookings");
  // Refunds are super-admin-only (matches the hard check in /api/admin/refund).
  const canRefund = currentUser.role === "super_admin";

  if (!canManageBookings) {
    return (
      <AdminShell user={{ name: currentUser.name, role: currentUser.role }}>
        <AccessDenied what="view bookings" />
      </AdminShell>
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
    <AdminShell user={{ name: currentUser.name, role: currentUser.role }}>
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <h1 className="font-heading text-3xl font-semibold">Bookings</h1>
        <a
          href={`/api/admin/bookings/export?${exportParams}`}
          className="ml-auto inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg px-4 py-2 font-semibold text-sm transition-colors"
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
          className="flex-1 bg-white border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-[#1d4ed8]"
        />
        <select
          name="eventId"
          defaultValue={eventId}
          className="bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#1d4ed8]"
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
          className="bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#1d4ed8]"
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
          className="bg-[#1d4ed8] hover:bg-[#1e40af] text-white rounded-lg px-5 py-2.5 font-semibold text-sm transition-colors"
        >
          Search
        </button>
      </form>

      {bookings.length === 0 ? (
        <p className="text-slate-500">No bookings found.</p>
      ) : (
        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-200 bg-slate-50">
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
                <tr key={b.razorpayOrderId} className="border-b border-slate-200 last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-medium">{b.attendeeName}</p>
                    <p className="text-xs text-slate-500">
                      {b.customerEmail} · {b.customerPhone}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {eventTitleById.get(b.eventId) ?? b.eventId}
                  </td>
                  <td className="px-4 py-3">{b.seatIds.join(", ")}</td>
                  <td className="px-4 py-3">
                    {b.ticketId ? (
                      <Link
                        href={`/ticket/${b.ticketId}`}
                        className="font-mono text-xs text-[#1d4ed8] hover:underline"
                      >
                        {b.ticketId}
                      </Link>
                    ) : (
                      <span className="text-slate-400">—</span>
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
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap text-xs">
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
                    {b.status === "PENDING" && <CancelBookingButton orderId={b.razorpayOrderId} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-slate-400 mt-4">
        {bookings.length} booking{bookings.length === 1 ? "" : "s"} shown. Refunds are full refunds
        via Razorpay and release the seats back to sale.
      </p>
    </AdminShell>
  );
}
