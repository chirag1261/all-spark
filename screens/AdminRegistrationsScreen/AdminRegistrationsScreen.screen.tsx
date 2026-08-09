import { ChevronLeft, ChevronRight, UserCheck } from "lucide-react";
import Link from "next/link";

import AccessDenied from "@/components/AccessDenied";
import AdminShell from "@/components/AdminShell";
import { hasPermission, requireDashboardPage } from "@/lib/auth/admin";
import { listBookings, listEvents } from "@/lib/db";

const GENDER_LABEL: Record<string, string> = {
  male: "Male",
  female: "Female",
  boy: "Boy",
  girl: "Girl",
  others: "Others",
};

/** One row per registered attendee (not per booking) — a single booking can
 *  carry several attendees, each with their own name/phone/email/gender.
 *  Only confirmed bookings count as an actual registration — a PENDING or
 *  FAILED checkout attempt for the same person would otherwise show up as a
 *  separate, misleadingly duplicate-looking entry. */
interface Registration {
  bookingId: string;
  eventId: string;
  seatId: string;
  name: string;
  phone: string;
  email: string;
  gender: string;
  createdAt: number;
}

type SortKey = "createdAt" | "name";
const SORT_KEYS: SortKey[] = ["createdAt", "name"];

const PAGE_SIZE = 20;

function sortValue(r: Registration, key: SortKey): string | number {
  switch (key) {
    case "createdAt":
      return r.createdAt;
    case "name":
      return r.name.toLowerCase();
  }
}

interface AdminRegistrationsScreenProps {
  q?: string;
  eventId?: string;
  sort?: string;
  dir?: string;
  page?: string;
}

export async function AdminRegistrationsScreen({
  q = "",
  eventId = "",
  sort = "createdAt",
  dir = "desc",
  page = "1",
}: AdminRegistrationsScreenProps) {
  const currentUser = await requireDashboardPage();
  // Registrations are the same underlying booking data the Bookings screen
  // manages, just sliced per attendee instead of per booking — same
  // permission gate.
  const canView = hasPermission(currentUser, "bookings");

  if (!canView) {
    return (
      <AdminShell user={{ name: currentUser.name, role: currentUser.role }}>
        <AccessDenied what="view registrations" />
      </AdminShell>
    );
  }

  const bookings = (await listBookings({ eventId: eventId || undefined })).filter(
    (b) => b.status === "CONFIRMED"
  );

  let registrations: Registration[] = bookings.flatMap((b) => {
    const attendeeBySeat = new Map(b.attendees.map((a) => [a.seatId, a]));
    return b.seatIds.map((seatId) => {
      const attendee = attendeeBySeat.get(seatId);
      return {
        bookingId: b.bookingId,
        eventId: b.eventId,
        seatId,
        name: attendee?.name || b.attendeeName,
        phone: attendee?.phone || b.customerPhone,
        email: attendee?.email || b.customerEmail,
        gender: attendee?.gender ? GENDER_LABEL[attendee.gender] : "",
        createdAt: b.createdAt,
      };
    });
  });

  const query = q.trim().toLowerCase();
  if (query) {
    registrations = registrations.filter((r) =>
      [r.name, r.phone, r.email, r.bookingId, r.seatId].join(" ").toLowerCase().includes(query)
    );
  }

  const sortKey: SortKey = SORT_KEYS.includes(sort as SortKey) ? (sort as SortKey) : "createdAt";
  const sortDir: "asc" | "desc" = dir === "asc" ? "asc" : "desc";
  const dirMul = sortDir === "asc" ? 1 : -1;
  registrations = [...registrations].sort((a, b) => {
    const av = sortValue(a, sortKey);
    const bv = sortValue(b, sortKey);
    if (av < bv) return -1 * dirMul;
    if (av > bv) return 1 * dirMul;
    return 0;
  });

  const events = await listEvents();
  const eventTitleById = new Map(events.map((e) => [e.id, e.title]));

  const totalPages = Math.max(1, Math.ceil(registrations.length / PAGE_SIZE));
  const currentPage = Math.min(Math.max(1, Number(page) || 1), totalPages);
  const pageRows = registrations.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const rangeStart = registrations.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(currentPage * PAGE_SIZE, registrations.length);

  const buildHref = (overrides: Record<string, string>) => {
    const params = new URLSearchParams();
    const merged = { q, eventId, sort: sortKey, dir: sortDir, page: String(currentPage), ...overrides };
    for (const [k, v] of Object.entries(merged)) {
      if (v) params.set(k, v);
    }
    return `/admin/registrations?${params.toString()}`;
  };

  return (
    <AdminShell user={{ name: currentUser.name, role: currentUser.role }}>
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <h1 className="font-heading text-3xl font-semibold">Registrations</h1>
      </div>

      {/* Attendee search + filters (GET form keeps the URL shareable) */}
      <form method="GET" className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search name, email, phone, booking or seat…"
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
        <button
          type="submit"
          className="bg-[#1d4ed8] hover:bg-[#1e40af] text-white rounded-lg px-5 py-2.5 font-semibold text-sm transition-colors"
        >
          Search
        </button>
      </form>

      {registrations.length === 0 ? (
        <div className="border border-dashed border-slate-200 rounded-2xl px-6 py-14 text-center">
          <UserCheck className="w-10 h-10 mx-auto mb-3 text-slate-800" aria-hidden="true" />
          <h3 className="font-semibold text-slate-900">No Registrations Found</h3>
          <p className="text-sm text-slate-800 max-w-sm mx-auto mt-1">
            No registrations match your current search or filters.
          </p>
        </div>
      ) : (
        <>
          <div className="max-h-[70vh] overflow-y-auto overflow-x-auto border border-slate-200 rounded-xl bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-white bg-[#1d4ed8] sticky top-0 z-10">
                  <SortTh sortKey="name" current={sortKey} dir={sortDir} buildHref={buildHref}>
                    Attendee
                  </SortTh>
                  <th className="px-4 py-3 font-medium bg-[#1d4ed8]">Gender</th>
                  <th className="px-4 py-3 font-medium bg-[#1d4ed8]">Event</th>
                  <th className="px-4 py-3 font-medium bg-[#1d4ed8]">Seat</th>
                  <th className="px-4 py-3 font-medium bg-[#1d4ed8]">Booking</th>
                  <SortTh sortKey="createdAt" current={sortKey} dir={sortDir} buildHref={buildHref}>
                    Registered
                  </SortTh>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((r) => (
                  <tr
                    key={`${r.bookingId}-${r.seatId}`}
                    className="border-b border-slate-200 last:border-0"
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="font-medium">{r.name}</p>
                      <p className="text-sm text-slate-800">
                        {r.email} · {r.phone}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      {r.gender || <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      {eventTitleById.get(r.eventId) ?? r.eventId}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-700 whitespace-nowrap">
                      {r.seatId}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Link
                        href={`/admin/bookings?q=${encodeURIComponent(r.bookingId)}`}
                        className="font-mono text-sm text-[#1d4ed8] hover:underline"
                      >
                        {r.bookingId}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap text-sm">
                      {new Date(r.createdAt).toLocaleString("en-IN", {
                        timeZone: "Asia/Kolkata",
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4 text-sm text-slate-700">
            <p>
              Showing {rangeStart}–{rangeEnd} of {registrations.length}
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
    </AdminShell>
  );
}

function SortTh({
  children,
  sortKey,
  current,
  dir,
  buildHref,
}: {
  children: React.ReactNode;
  sortKey: SortKey;
  current: SortKey;
  dir: "asc" | "desc";
  buildHref: (overrides: Record<string, string>) => string;
}) {
  const isActive = current === sortKey;
  const nextDir = isActive && dir === "asc" ? "desc" : "asc";
  return (
    <th className="px-4 py-3 font-medium bg-[#1d4ed8] text-left">
      <Link
        href={buildHref({ sort: sortKey, dir: nextDir, page: "1" })}
        className={`inline-flex items-center gap-1 hover:text-white transition-colors ${
          isActive ? "text-white font-semibold" : "text-white/80"
        }`}
      >
        {children}
        <span className="text-sm">{isActive ? (dir === "asc" ? "▲" : "▼") : "⇅"}</span>
      </Link>
    </th>
  );
}
