"use client";

import { useEffect, useMemo, useState } from "react";

import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Eye,
  Mic,
  Pencil,
  Plus,
  Search,
  Ticket,
  X,
} from "lucide-react";
import Link from "next/link";

import { EventItem } from "@/types";
import { formatDateIST, inr } from "@/utils";

import EventForm from "../EventForm";

export interface EventRow {
  event: EventItem;
  registrationOpen: "upcoming" | "open" | "closed";
  registrations: number;
  revenue: number;
  remaining: number;
  total: number;
}

interface Props {
  rows: EventRow[];
  cloudinaryEnabled: boolean;
}

type Filter = "all" | "live" | "drafts" | "past";
type SortKey = "title" | "startsAt" | "registrations" | "revenue" | "remaining" | "updatedAt";
type SortDir = "asc" | "desc";

const FILTER_LABELS: Record<Filter, string> = {
  all: "All events",
  live: "Live",
  drafts: "Drafts",
  past: "Past events",
};

const PAGE_SIZE = 10;

/**
 * Which lifecycle bucket a row belongs to. Every event is exactly one of
 * drafts (unpublished) / past (published & already happened) / live
 * (published & upcoming) — the status badge shows the finer-grained state.
 */
function lifecycleOf(row: EventRow, now: number): Exclude<Filter, "all"> {
  if (!row.event.published) return "drafts";
  if (new Date(row.event.startsAt).getTime() < now) return "past";
  return "live";
}

function sortValue(row: EventRow, key: SortKey): string | number {
  switch (key) {
    case "title":
      return row.event.title.toLowerCase();
    case "startsAt":
      return new Date(row.event.startsAt).getTime();
    case "updatedAt":
      return row.event.updatedAt;
    case "registrations":
      return row.registrations;
    case "revenue":
      return row.revenue;
    case "remaining":
      return row.remaining;
  }
}

/** Events table. Viewing + updating live here (edit opens a slide-over drawer);
 *  creating a new event is its own screen at /admin/events/new. */
export default function AdminEventsPanel({ rows, cloudinaryEnabled }: Props) {
  // The id of the event being edited, or null when the drawer is closed.
  const [drawer, setDrawer] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("startsAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);
  // Captured once at mount — "past vs upcoming" only needs coarse accuracy and
  // must stay stable across renders (calling Date.now() in render is impure).
  const [now] = useState(() => Date.now());
  const editing = drawer ? rows.find((r) => r.event.id === drawer)?.event : undefined;

  // Close on Escape.
  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawer(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawer]);

  // Any change to the active filters should snap back to page 1. Adjusted
  // during render (React's recommended pattern for this) rather than in an
  // effect, which would cause an extra post-commit render pass.
  const filterSignature = `${filter}|${query}|${dateFrom}|${dateTo}`;
  const [prevFilterSignature, setPrevFilterSignature] = useState(filterSignature);
  if (filterSignature !== prevFilterSignature) {
    setPrevFilterSignature(filterSignature);
    setPage(1);
  }

  const counts = useMemo(() => {
    const c = { all: rows.length, live: 0, drafts: 0, past: 0 };
    for (const row of rows) c[lifecycleOf(row, now)]++;
    return c;
  }, [rows, now]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "title" ? "asc" : "desc");
    }
  };

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const from = dateFrom ? new Date(dateFrom).getTime() : null;
    // End-of-day so the "to" date is inclusive.
    const to = dateTo ? new Date(dateTo).getTime() + 24 * 60 * 60 * 1000 - 1 : null;
    return rows.filter((r) => {
      if (filter !== "all" && lifecycleOf(r, now) !== filter) return false;
      if (q) {
        const haystack =
          `${r.event.title} ${r.event.id} ${r.event.venue} ${r.event.city}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      const startsAtMs = new Date(r.event.startsAt).getTime();
      if (from !== null && startsAtMs < from) return false;
      if (to !== null && startsAtMs > to) return false;
      return true;
    });
  }, [rows, filter, now, query, dateFrom, dateTo]);

  const sortedRows = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filteredRows].sort((a, b) => {
      const av = sortValue(a, sortKey);
      const bv = sortValue(b, sortKey);
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }, [filteredRows, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = sortedRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const rangeStart = sortedRows.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(currentPage * PAGE_SIZE, sortedRows.length);

  return (
    <>
      <div className="flex items-center gap-4 mb-4">
        <h2 className="text-lg font-semibold">Events</h2>
        <Link
          href="/admin/events/new"
          className="ml-auto inline-flex items-center gap-1.5 bg-[#1d4ed8] hover:bg-[#1e40af] text-white rounded-lg px-4 py-2 font-semibold text-sm transition-colors"
        >
          <Plus className="w-4 h-4" aria-hidden="true" /> New event
        </Link>
      </div>

      {/* Lifecycle filter tabs */}
      {rows.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {(Object.keys(FILTER_LABELS) as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium border transition-colors ${
                filter === f
                  ? "bg-[#1d4ed8]/15 border-[#1d4ed8]/50 text-slate-900"
                  : "bg-white border-slate-200 text-slate-600 hover:text-slate-800 hover:border-slate-300"
              }`}
            >
              {FILTER_LABELS[f]}
              <span className="ml-1.5 text-sm text-slate-800">{counts[f]}</span>
            </button>
          ))}
        </div>
      )}

      {/* Search + date range */}
      {rows.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
              aria-hidden="true"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search event name, event ID, venue or city…"
              className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-2.5 text-sm outline-none focus:border-[#1d4ed8]"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              aria-label="From date"
              className="bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#1d4ed8] dt-input"
            />
            <span className="text-slate-400 text-sm">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              aria-label="To date"
              className="bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#1d4ed8] dt-input"
            />
            {(dateFrom || dateTo) && (
              <button
                onClick={() => {
                  setDateFrom("");
                  setDateTo("");
                }}
                aria-label="Clear date filter"
                className="w-9 h-9 inline-flex items-center justify-center rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState />
      ) : sortedRows.length === 0 ? (
        <p className="text-slate-800 border border-dashed border-slate-200 rounded-xl px-4 py-10 text-center text-sm">
          No events match your search or filters.
        </p>
      ) : (
        <>
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-white bg-[#1d4ed8]">
                  <Th sortKey="title" active={sortKey} dir={sortDir} onSort={toggleSort}>
                    Event
                  </Th>
                  <Th sortKey="startsAt" active={sortKey} dir={sortDir} onSort={toggleSort}>
                    Starts
                  </Th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <Th
                    sortKey="registrations"
                    active={sortKey}
                    dir={sortDir}
                    onSort={toggleSort}
                    align="right"
                  >
                    Registrations
                  </Th>
                  <Th sortKey="revenue" active={sortKey} dir={sortDir} onSort={toggleSort} align="right">
                    Revenue
                  </Th>
                  <Th
                    sortKey="remaining"
                    active={sortKey}
                    dir={sortDir}
                    onSort={toggleSort}
                    align="right"
                  >
                    Availability
                  </Th>
                  <Th sortKey="updatedAt" active={sortKey} dir={sortDir} onSort={toggleSort}>
                    Last updated
                  </Th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map(
                  ({ event, registrationOpen, registrations, revenue, remaining, total }) => {
                    const soldPct = total > 0 ? Math.min(100, (1 - remaining / total) * 100) : 0;
                    const barTone =
                      remaining <= 0
                        ? "bg-red-500"
                        : remaining / Math.max(total, 1) <= 0.15
                          ? "bg-amber-500"
                          : "bg-emerald-500";
                    return (
                      <tr key={event.id} className="border-b border-slate-200 last:border-0">
                        <td className="px-4 py-3 max-w-60">
                          <div className="flex items-center gap-2">
                            <p className="font-medium truncate" title={event.title}>
                              {event.title}
                            </p>
                            {event.featured && (
                              <span
                                title="This event takes over the public homepage as the featured landing page."
                                className="shrink-0 text-[10px] font-bold uppercase tracking-wide bg-[#1d4ed8]/15 text-[#1d4ed8] px-1.5 py-0.5 rounded cursor-pointer"
                              >
                                Landing page
                              </span>
                            )}
                          </div>
                          <p
                            className="text-sm text-slate-800 truncate"
                            title={`${event.venue}, ${event.city}`}
                          >
                            {event.venue}, {event.city}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                          {formatDateIST(event.startsAt)}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge
                            published={event.published}
                            remaining={remaining}
                            registrationOpen={registrationOpen}
                          />
                        </td>
                        <td className="px-4 py-3 text-right">{registrations}</td>
                        <td className="px-4 py-3 text-right">{inr(revenue)}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1 min-w-27.5">
                            <span className="text-sm font-medium text-right">
                              {remaining <= 0
                                ? "Sold out"
                                : `${remaining} seat${remaining === 1 ? "" : "s"} left`}
                            </span>
                            <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${barTone}`}
                                style={{ width: `${soldPct}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap text-sm">
                          {new Date(event.updatedAt).toLocaleString("en-IN", {
                            timeZone: "Asia/Kolkata",
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <IconButton title="Edit event" onClick={() => setDrawer(event.id)}>
                              <Pencil className="w-4 h-4" />
                            </IconButton>
                            <IconLink
                              title="Duplicate event"
                              href={`/admin/events/new?cloneFrom=${event.id}`}
                            >
                              <Copy className="w-4 h-4" />
                            </IconLink>
                            <IconLink
                              title="View registrations"
                              href={`/admin/bookings?eventId=${event.id}`}
                            >
                              <Ticket className="w-4 h-4" />
                            </IconLink>
                            {event.published ? (
                              <IconLink
                                title="Preview public page"
                                href={`/events/${event.id}`}
                                newTab
                              >
                                <Eye className="w-4 h-4" />
                              </IconLink>
                            ) : (
                              <IconButton
                                title="Publish this event to preview its public page"
                                disabled
                              >
                                <Eye className="w-4 h-4" />
                              </IconButton>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  }
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4 text-sm text-slate-700">
            <p>
              Showing {rangeStart}–{rangeEnd} of {sortedRows.length}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                aria-label="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-slate-800">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                aria-label="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </>
      )}

      {/* Right slide-over drawer */}
      {drawer && (
        <div className="fixed inset-0 z-40" role="dialog" aria-modal="true">
          <button
            aria-label="Close editor"
            onClick={() => setDrawer(null)}
            className="absolute inset-0 bg-black/60 backdrop-blur-xs cursor-default"
          />
          <div className="absolute inset-y-0 right-0 w-full max-w-2xl bg-white border-l border-slate-200 shadow-2xl flex flex-col animate-[slide-in_.2s_ease-out]">
            <div className="flex items-center gap-3 px-6 h-16 border-b border-slate-200 shrink-0">
              <h2 className="font-bold text-lg">Edit event</h2>
              {editing && <span className="text-sm text-slate-800 truncate">{editing.title}</span>}
              <button
                onClick={() => setDrawer(null)}
                aria-label="Close"
                className="ml-auto w-8 h-8 inline-flex items-center justify-center rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="overflow-y-auto p-6">
              <EventForm
                key={drawer}
                event={editing}
                cloudinaryEnabled={cloudinaryEnabled}
                onDone={() => setDrawer(null)}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Th({
  children,
  sortKey,
  active,
  dir,
  onSort,
  align = "left",
}: {
  children: React.ReactNode;
  sortKey: SortKey;
  active: SortKey;
  dir: SortDir;
  onSort: (key: SortKey) => void;
  align?: "left" | "right";
}) {
  const isActive = active === sortKey;
  return (
    <th className={`px-4 py-3 font-medium ${align === "right" ? "text-right" : "text-left"}`}>
      <button
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 hover:text-white transition-colors ${
          align === "right" ? "flex-row-reverse" : ""
        } ${isActive ? "text-white font-semibold" : "text-white/80"}`}
      >
        {children}
        {isActive ? (
          dir === "asc" ? (
            <ArrowUp className="w-3.5 h-3.5" aria-hidden="true" />
          ) : (
            <ArrowDown className="w-3.5 h-3.5" aria-hidden="true" />
          )
        ) : (
          <ArrowUpDown className="w-3.5 h-3.5 opacity-50" aria-hidden="true" />
        )}
      </button>
    </th>
  );
}

function StatusBadge({
  published,
  remaining,
  registrationOpen,
}: {
  published: boolean;
  remaining: number;
  registrationOpen: EventRow["registrationOpen"];
}) {
  if (!published)
    return (
      <Badge
        tone="zinc"
        title="Draft events are hidden from the public site until you publish them."
      >
        Draft
      </Badge>
    );
  if (remaining <= 0)
    return (
      <Badge tone="red" title="Every seat is booked or blocked — no tickets left to sell.">
        Sold out
      </Badge>
    );
  if (registrationOpen === "open")
    return (
      <Badge tone="emerald" title="Published and open for bookings right now.">
        Live
      </Badge>
    );
  if (registrationOpen === "upcoming")
    return (
      <Badge tone="sky" title="Published, but bookings haven't opened yet.">
        Opens soon
      </Badge>
    );
  return (
    <Badge tone="zinc" title="Bookings have closed for this event.">
      Closed
    </Badge>
  );
}

function EmptyState() {
  return (
    <div className="border border-dashed border-slate-200 rounded-2xl px-6 py-14 text-center">
      <Mic className="w-10 h-10 mx-auto mb-3 text-slate-800" aria-hidden="true" />
      <h3 className="font-semibold text-slate-900 mb-1">No events created yet</h3>
      <p className="text-sm text-slate-800 max-w-sm mx-auto mb-5">
        Launch your first standup comedy night or music concert — add the details, seating and
        pricing, then publish it to the public site.
      </p>
      <Link
        href="/admin/events/new"
        className="inline-flex items-center gap-1.5 bg-[#1d4ed8] hover:bg-[#1e40af] text-white rounded-lg px-5 py-2.5 font-semibold text-sm transition-colors"
      >
        <Plus className="w-4 h-4" aria-hidden="true" /> New event
      </Link>
    </div>
  );
}

function IconButton({
  title,
  onClick,
  disabled,
  children,
}: {
  title: string;
  onClick?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed"
    >
      {children}
    </button>
  );
}

function IconLink({
  title,
  href,
  newTab,
  children,
}: {
  title: string;
  href: string;
  newTab?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      title={title}
      aria-label={title}
      {...(newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
    >
      {children}
    </Link>
  );
}

function Badge({
  tone,
  title,
  children,
}: {
  tone: "emerald" | "red" | "sky" | "zinc";
  title: string;
  children: string;
}) {
  const tones = {
    emerald: "bg-emerald-50 text-emerald-700",
    red: "bg-red-50 text-red-700",
    sky: "bg-sky-50 text-sky-700",
    zinc: "bg-slate-100 text-slate-600",
  } as const;
  return (
    <span
      title={title}
      className={`inline-block text-sm font-semibold px-2 py-0.5 rounded cursor-help ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
