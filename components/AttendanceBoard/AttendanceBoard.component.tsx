"use client";

import { useCallback, useEffect, useState } from "react";

import { ChevronLeft, ChevronRight } from "lucide-react";

interface EventOption {
  id: string;
  title: string;
}

interface Attendee {
  ticketId: string;
  name: string;
  seat: string;
  status: "IN" | "PENDING";
  scannedAt: number | null;
  scannedByName: string | null;
}

type SortKey = "name" | "seat" | "scannedAt";

const PAGE_SIZE = 20;

function sortValue(a: Attendee, key: SortKey): string | number {
  switch (key) {
    case "name":
      return a.name.toLowerCase();
    case "seat":
      return a.seat;
    case "scannedAt":
      return a.scannedAt ?? 0;
  }
}

/**
 * Live event-entry dashboard: sold-vs-checked-in counters and the attendee
 * list, polled every ~5s (the app is serverless, so polling rather than
 * WebSockets). Reads the same endpoint the scanner writes to.
 */
export default function AttendanceBoard({ events }: { events: EventOption[] }) {
  const [eventId, setEventId] = useState(events[0]?.id ?? "");
  const [counts, setCounts] = useState<{ sold: number; checkedIn: number } | null>(null);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);

  const refresh = useCallback(async () => {
    if (!eventId) return;
    try {
      const res = await fetch(`/api/admin/attendance?eventId=${encodeURIComponent(eventId)}`);
      if (res.ok) {
        const data = await res.json();
        setCounts(data.counts);
        setAttendees(data.attendees);
      }
    } catch {
      /* transient — next poll retries */
    }
  }, [eventId]);

  useEffect(() => {
    if (!eventId) return;
    const first = setTimeout(refresh, 0);
    const id = setInterval(refresh, 5000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [eventId, refresh]);

  const pct = counts && counts.sold > 0 ? Math.round((counts.checkedIn / counts.sold) * 100) : 0;

  const q = search.trim().toLowerCase();
  const filtered = q
    ? attendees.filter(
        (a) => a.name.toLowerCase().includes(q) || a.seat.toLowerCase().includes(q)
      )
    : attendees;

  const dirMul = sortDir === "asc" ? 1 : -1;
  const sorted = [...filtered].sort((a, b) => {
    const av = sortValue(a, sortKey);
    const bv = sortValue(b, sortKey);
    return av < bv ? -1 * dirMul : av > bv ? 1 * dirMul : 0;
  });

  // Reset to page 1 whenever the event or search term changes — adjusting
  // state during render (rather than a useEffect) per React's recommended
  // pattern for derived resets.
  const filterSignature = `${eventId}|${q}`;
  const [prevFilterSignature, setPrevFilterSignature] = useState(filterSignature);
  if (filterSignature !== prevFilterSignature) {
    setPrevFilterSignature(filterSignature);
    setPage(1);
  }

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const rangeStart = sorted.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(currentPage * PAGE_SIZE, sorted.length);
  const pageAttendees = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 sm:items-end">
        <div className="max-w-sm w-full">
          <label className="block text-sm text-slate-800 mb-1.5">Event</label>
          <select
            value={eventId}
            onChange={(e) => {
              setEventId(e.target.value);
              setCounts(null);
              setAttendees([]);
            }}
            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#1d4ed8]"
          >
            {events.length === 0 && <option value="">No published events</option>}
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title}
              </option>
            ))}
          </select>
        </div>
        <div className="max-w-sm w-full">
          <label className="block text-sm text-slate-800 mb-1.5">Search</label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Attendee name or seat…"
            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#1d4ed8]"
          />
        </div>
      </div>

      {counts && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <div className="flex items-end gap-6">
            <div>
              <p className="text-3xl font-bold text-emerald-700">{counts.checkedIn}</p>
              <p className="text-sm text-slate-800">Checked in</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-slate-800">{counts.sold}</p>
              <p className="text-sm text-slate-800">Tickets sold</p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-3xl font-bold text-[#1d4ed8]">{pct}%</p>
              <p className="text-sm text-slate-800">Attendance</p>
            </div>
          </div>
          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      <div className="max-h-[70vh] overflow-y-auto overflow-x-auto border border-slate-200 rounded-xl bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-white bg-[#1d4ed8] sticky top-0 z-10">
              <SortTh sortKey="name" current={sortKey} dir={sortDir} onSort={toggleSort}>
                Attendee
              </SortTh>
              <SortTh sortKey="seat" current={sortKey} dir={sortDir} onSort={toggleSort}>
                Seat
              </SortTh>
              <th className="px-4 py-3 font-medium bg-[#1d4ed8]">Status</th>
              <SortTh sortKey="scannedAt" current={sortKey} dir={sortDir} onSort={toggleSort}>
                Checked in
              </SortTh>
              <th className="px-4 py-3 font-medium bg-[#1d4ed8]">By</th>
            </tr>
          </thead>
          <tbody>
            {pageAttendees.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-700">
                  {attendees.length === 0
                    ? "No tickets issued for this event yet."
                    : "No attendees match your search."}
                </td>
              </tr>
            ) : (
              pageAttendees.map((a) => (
                <tr key={a.ticketId} className="border-b border-slate-200 last:border-0">
                  <td className="px-4 py-3">{a.name}</td>
                  <td className="px-4 py-3 text-slate-600">{a.seat}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block text-sm font-semibold px-2 py-0.5 rounded ${
                        a.status === "IN"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {a.status === "IN" ? "In" : "Pending"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap text-sm">
                    {a.scannedAt
                      ? new Date(a.scannedAt).toLocaleString("en-IN", {
                          timeZone: "Asia/Kolkata",
                          dateStyle: "medium",
                          timeStyle: "short",
                        })
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{a.scannedByName ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {sorted.length > 0 && (
        <div className="flex items-center justify-between text-sm text-slate-700">
          <p>
            Showing {rangeStart}–{rangeEnd} of {sorted.length}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              aria-label="Previous page"
              disabled={currentPage <= 1}
              className={`w-8 h-8 inline-flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors ${
                currentPage <= 1
                  ? "opacity-30 pointer-events-none text-slate-600"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-slate-800">
              Page {currentPage} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              aria-label="Next page"
              disabled={currentPage >= totalPages}
              className={`w-8 h-8 inline-flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors ${
                currentPage >= totalPages
                  ? "opacity-30 pointer-events-none text-slate-600"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SortTh({
  children,
  sortKey,
  current,
  dir,
  onSort,
}: {
  children: React.ReactNode;
  sortKey: SortKey;
  current: SortKey;
  dir: "asc" | "desc";
  onSort: (key: SortKey) => void;
}) {
  const isActive = current === sortKey;
  return (
    <th className="px-4 py-3 font-medium bg-[#1d4ed8] text-left">
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 hover:text-white transition-colors ${
          isActive ? "text-white font-semibold" : "text-white/80"
        }`}
      >
        {children}
        <span className="text-sm">{isActive ? (dir === "asc" ? "▲" : "▼") : "⇅"}</span>
      </button>
    </th>
  );
}
