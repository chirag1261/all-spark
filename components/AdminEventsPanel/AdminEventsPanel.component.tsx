"use client";

import { useEffect, useMemo, useState } from "react";

import { Copy, Eye, Mic, Pencil, Plus, Ticket, X } from "lucide-react";
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

const FILTER_LABELS: Record<Filter, string> = {
  all: "All events",
  live: "Live",
  drafts: "Drafts",
  past: "Past events",
};

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

/** Events table. Viewing + updating live here (edit opens a slide-over drawer);
 *  creating a new event is its own screen at /admin/events/new. */
export default function AdminEventsPanel({ rows, cloudinaryEnabled }: Props) {
  // The id of the event being edited, or null when the drawer is closed.
  const [drawer, setDrawer] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
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

  const counts = useMemo(() => {
    const c = { all: rows.length, live: 0, drafts: 0, past: 0 };
    for (const row of rows) c[lifecycleOf(row, now)]++;
    return c;
  }, [rows, now]);

  const visibleRows = useMemo(
    () => (filter === "all" ? rows : rows.filter((r) => lifecycleOf(r, now) === filter)),
    [rows, filter, now]
  );

  return (
    <>
      <div className="flex items-center gap-4 mb-4">
        <h2 className="text-lg font-semibold">Events</h2>
        <Link
          href="/admin/events/new"
          className="ml-auto inline-flex items-center gap-1.5 bg-[#d99a45] hover:bg-[#bf863a] rounded-lg px-4 py-2 font-semibold text-sm transition-colors"
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
                  ? "bg-[#d99a45]/15 border-[#d99a45]/50 text-zinc-100"
                  : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700"
              }`}
            >
              {FILTER_LABELS[f]}
              <span className="ml-1.5 text-xs text-zinc-500">{counts[f]}</span>
            </button>
          ))}
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState />
      ) : visibleRows.length === 0 ? (
        <p className="text-zinc-500 border border-dashed border-zinc-800 rounded-xl px-4 py-10 text-center text-sm">
          No {FILTER_LABELS[filter].toLowerCase()} to show.
        </p>
      ) : (
        <div className="overflow-x-auto border border-zinc-800 rounded-xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-zinc-500 border-b border-zinc-800 bg-zinc-900/60">
                <th className="px-4 py-3 font-medium">Event</th>
                <th className="px-4 py-3 font-medium">Starts</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Registrations</th>
                <th className="px-4 py-3 font-medium text-right">Revenue</th>
                <th className="px-4 py-3 font-medium text-right">Seats left</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map(
                ({ event, registrationOpen, registrations, revenue, remaining, total }) => (
                  <tr key={event.id} className="border-b border-zinc-800/60 last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-medium">
                        {event.title}
                        {event.featured && (
                          <span
                            title="This event takes over the public homepage as the featured landing page."
                            className="ml-2 text-[10px] font-bold uppercase tracking-wide bg-[#d99a45]/15 text-[#d99a45] px-1.5 py-0.5 rounded cursor-help"
                          >
                            Landing page
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {event.venue}, {event.city}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-zinc-400 whitespace-nowrap">
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
                    <td className="px-4 py-3 text-right">
                      {remaining}
                      <span className="text-zinc-600">/{total}</span>
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
                          <IconLink title="Preview public page" href={`/events/${event.id}`} newTab>
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
                )
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Right slide-over drawer */}
      {drawer && (
        <div className="fixed inset-0 z-40" role="dialog" aria-modal="true">
          <button
            aria-label="Close editor"
            onClick={() => setDrawer(null)}
            className="absolute inset-0 bg-black/60 backdrop-blur-xs cursor-default"
          />
          <div className="absolute inset-y-0 right-0 w-full max-w-2xl bg-zinc-950 border-l border-zinc-800 shadow-2xl flex flex-col animate-[slide-in_.2s_ease-out]">
            <div className="flex items-center gap-3 px-6 h-16 border-b border-zinc-800 shrink-0">
              <h2 className="font-bold text-lg">Edit event</h2>
              {editing && <span className="text-xs text-zinc-500 truncate">{editing.title}</span>}
              <button
                onClick={() => setDrawer(null)}
                aria-label="Close"
                className="ml-auto w-8 h-8 inline-flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
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
    <div className="border border-dashed border-zinc-800 rounded-2xl px-6 py-14 text-center">
      <Mic className="w-10 h-10 mx-auto mb-3 text-zinc-500" aria-hidden="true" />
      <h3 className="font-semibold text-zinc-100 mb-1">No events created yet</h3>
      <p className="text-sm text-zinc-500 max-w-sm mx-auto mb-5">
        Launch your first standup comedy night or music concert — add the details, seating and
        pricing, then publish it to the public site.
      </p>
      <Link
        href="/admin/events/new"
        className="inline-flex items-center gap-1.5 bg-[#d99a45] hover:bg-[#bf863a] rounded-lg px-5 py-2.5 font-semibold text-sm transition-colors"
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
      className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed"
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
      className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
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
    emerald: "bg-emerald-500/15 text-emerald-400",
    red: "bg-red-500/15 text-red-400",
    sky: "bg-sky-500/15 text-sky-400",
    zinc: "bg-zinc-500/15 text-zinc-400",
  } as const;
  return (
    <span
      title={title}
      className={`inline-block text-xs font-semibold px-2 py-0.5 rounded cursor-help ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
