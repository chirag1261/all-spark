import { ChevronLeft, ChevronRight, Download, Ticket } from "lucide-react";
import Link from "next/link";

import AccessDenied from "@/components/AccessDenied";
import AdminShell from "@/components/AdminShell";
import BookingSeatsCell from "@/components/BookingSeatsCell";
import CancelBookingButton from "@/components/CancelBookingButton";
import RefundButton from "@/components/RefundButton";
import TicketTransferButton from "@/components/TicketTransferButton";
import { hasPermission, requireDashboardPage } from "@/lib/auth/admin";
import { listBookings, listEvents, sweepStalePending } from "@/lib/db";
import { Booking, BookingStatus } from "@/types";
import { inr } from "@/utils";

const STATUS_TONES: Record<BookingStatus, string> = {
  CONFIRMED: "bg-emerald-50 text-emerald-700",
  PENDING: "bg-amber-50 text-amber-700",
  FAILED: "bg-slate-100 text-slate-600",
  REFUNDED: "bg-sky-50 text-sky-700",
};

type SortKey = "createdAt" | "amount" | "status" | "attendee";
const SORT_KEYS: SortKey[] = ["createdAt", "amount", "status", "attendee"];

const PAGE_SIZE = 20;

function sortValue(b: Booking, key: SortKey): string | number {
  switch (key) {
    case "createdAt":
      return b.createdAt;
    case "amount":
      return b.amount;
    case "status":
      return b.status;
    case "attendee":
      return b.attendeeName.toLowerCase();
  }
}

interface AdminBookingsScreenProps {
  q?: string;
  eventId?: string;
  status?: string;
  sort?: string;
  dir?: string;
  page?: string;
}

export async function AdminBookingsScreen({
  q = "",
  eventId = "",
  status = "",
  sort = "createdAt",
  dir = "desc",
  page = "1",
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

  const sortKey: SortKey = SORT_KEYS.includes(sort as SortKey) ? (sort as SortKey) : "createdAt";
  const sortDir: "asc" | "desc" = dir === "asc" ? "asc" : "desc";
  const dirMul = sortDir === "asc" ? 1 : -1;
  bookings = [...bookings].sort((a, b) => {
    const av = sortValue(a, sortKey);
    const bv = sortValue(b, sortKey);
    if (av < bv) return -1 * dirMul;
    if (av > bv) return 1 * dirMul;
    return 0;
  });

  const events = await listEvents();
  const eventTitleById = new Map(events.map((e) => [e.id, e.title]));
  const eventStartsAtById = new Map(events.map((e) => [e.id, e.startsAt]));

  const totalPages = Math.max(1, Math.ceil(bookings.length / PAGE_SIZE));
  const currentPage = Math.min(Math.max(1, Number(page) || 1), totalPages);
  const pageBookings = bookings.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const rangeStart = bookings.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(currentPage * PAGE_SIZE, bookings.length);

  // Builds a query string for a link, merging the current filters with overrides.
  const buildHref = (overrides: Record<string, string>) => {
    const params = new URLSearchParams();
    const merged = { q, eventId, status, sort: sortKey, dir: sortDir, page: String(currentPage), ...overrides };
    for (const [k, v] of Object.entries(merged)) {
      if (v) params.set(k, v);
    }
    return `/admin/bookings?${params.toString()}`;
  };

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
        <div className="border border-dashed border-slate-200 rounded-2xl px-6 py-14 text-center">
          <Ticket className="w-10 h-10 mx-auto mb-3 text-slate-800" aria-hidden="true" />
          <h3 className="font-semibold text-slate-900">No Bookings Found</h3>
          <p className="text-sm text-slate-800 max-w-sm mx-auto mt-1">
            No bookings match your current search or filters.
          </p>
        </div>
      ) : (
        <>
          <div className="max-h-[70vh] overflow-y-auto overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-white bg-[#1d4ed8] sticky top-0 z-10">
                  <SortTh sortKey="attendee" current={sortKey} dir={sortDir} buildHref={buildHref}>
                    Attendee
                  </SortTh>
                  <th className="px-4 py-3 font-medium bg-[#1d4ed8]">Event</th>
                  <th className="px-4 py-3 font-medium bg-[#1d4ed8]">Seats</th>
                  <th className="px-4 py-3 font-medium bg-[#1d4ed8]">Ticket</th>
                  <SortTh
                    sortKey="amount"
                    current={sortKey}
                    dir={sortDir}
                    buildHref={buildHref}
                    align="right"
                  >
                    Amount
                  </SortTh>
                  <th className="px-4 py-3 font-medium bg-[#1d4ed8]">Status</th>
                  <SortTh sortKey="createdAt" current={sortKey} dir={sortDir} buildHref={buildHref}>
                    Booked
                  </SortTh>
                  <th className="px-4 py-3 bg-[#1d4ed8]" />
                </tr>
              </thead>
              <tbody>
                {pageBookings.map((b) => (
                  <tr key={b.razorpayOrderId} className="border-b border-slate-200 last:border-0">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="font-medium">{b.attendeeName}</p>
                      <p className="text-sm text-slate-800">
                        {b.customerEmail} · {b.customerPhone}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      {eventTitleById.get(b.eventId) ?? b.eventId}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <BookingSeatsCell
                        bookingId={b.bookingId}
                        seatIds={b.seatIds}
                        hasTickets={b.status === "CONFIRMED"}
                      />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {b.ticketId ? (
                        <Link
                          href={`/ticket/${b.ticketId}`}
                          className="font-mono text-sm text-[#1d4ed8] hover:underline"
                        >
                          {b.ticketId}
                        </Link>
                      ) : (
                        <span className="text-slate-700">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">{inr(b.amount)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`inline-block text-sm font-semibold px-2 py-0.5 rounded ${STATUS_TONES[b.status]}`}
                      >
                        {b.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap text-sm">
                      {new Date(b.createdAt).toLocaleString("en-IN", {
                        timeZone: "Asia/Kolkata",
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </td>
                    <td className="px-4 py-3 text-right text-sm whitespace-nowrap">
                      <div className="flex items-center justify-end gap-3">
                        {b.status === "CONFIRMED" && canRefund && (
                          <TicketTransferButton bookingId={b.bookingId} />
                        )}
                        {b.status === "CONFIRMED" && canRefund && (
                          <RefundButton
                            orderId={b.razorpayOrderId}
                            amount={b.amount}
                            eventStartsAt={eventStartsAtById.get(b.eventId)}
                          />
                        )}
                        {b.status === "PENDING" && <CancelBookingButton orderId={b.razorpayOrderId} />}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4 text-sm text-slate-700">
            <p>
              Showing {rangeStart}–{rangeEnd} of {bookings.length}
            </p>
            <div className="flex items-center gap-2">
              <Link
                href={buildHref({ page: String(Math.max(1, currentPage - 1)) })}
                aria-label="Previous page"
                aria-disabled={currentPage <= 1}
                className={`w-8 h-8 inline-flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors ${
                  currentPage <= 1
                    ? "opacity-30 pointer-events-none text-slate-600"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <ChevronLeft className="w-4 h-4" />
              </Link>
              <span className="text-slate-800">
                Page {currentPage} of {totalPages}
              </span>
              <Link
                href={buildHref({ page: String(Math.min(totalPages, currentPage + 1)) })}
                aria-label="Next page"
                aria-disabled={currentPage >= totalPages}
                className={`w-8 h-8 inline-flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors ${
                  currentPage >= totalPages
                    ? "opacity-30 pointer-events-none text-slate-600"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </>
      )}

      <p className="text-sm text-slate-700 mt-4">
        Refunds are issued via Razorpay and release the seats back to sale — 70% refund (30%
        cancellation charge) more than 7 days before the event, 50% from 7 days down to 48 hours
        before, and blocked entirely inside the final 48 hours.
      </p>
    </AdminShell>
  );
}

function SortTh({
  children,
  sortKey,
  current,
  dir,
  buildHref,
  align = "left",
}: {
  children: React.ReactNode;
  sortKey: SortKey;
  current: SortKey;
  dir: "asc" | "desc";
  buildHref: (overrides: Record<string, string>) => string;
  align?: "left" | "right";
}) {
  const isActive = current === sortKey;
  const nextDir = isActive && dir === "asc" ? "desc" : "asc";
  return (
    <th
      className={`px-4 py-3 font-medium bg-[#1d4ed8] ${align === "right" ? "text-right" : "text-left"}`}
    >
      <Link
        href={buildHref({ sort: sortKey, dir: nextDir, page: "1" })}
        className={`inline-flex items-center gap-1 hover:text-white transition-colors ${
          align === "right" ? "flex-row-reverse" : ""
        } ${isActive ? "text-white font-semibold" : "text-white/80"}`}
      >
        {children}
        <span className="text-sm">{isActive ? (dir === "asc" ? "▲" : "▼") : "⇅"}</span>
      </Link>
    </th>
  );
}
