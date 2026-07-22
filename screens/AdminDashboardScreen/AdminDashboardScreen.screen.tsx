import { ClipboardList } from "lucide-react";

import ActivityFeed from "@/components/ActivityFeed";
import AdminShell from "@/components/AdminShell";
import InfoTip from "@/components/InfoTip";
import { requireDashboardPage } from "@/lib/auth/admin";
import {
  getBookedSeatCounts,
  listAudit,
  listBookings,
  listEvents,
  sweepStalePending,
} from "@/lib/db";
import { totalSeats } from "@/lib/domain/events";
import { Booking } from "@/types";
import { inr } from "@/utils";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

interface Trend {
  pct: number;
  dir: "up" | "down";
}

/** Week-over-week change; null when there's no meaningful comparison to show. */
function trendOf(current: number, previous: number): Trend | null {
  if (previous === 0) return current > 0 ? { pct: 100, dir: "up" } : null;
  const raw = Math.round(((current - previous) / previous) * 100);
  if (raw === 0) return null;
  return { pct: Math.abs(raw), dir: raw > 0 ? "up" : "down" };
}

/** Compares confirmed bookings in the last 7 days against the 7 days before. */
function weekTrends(bookings: Booking[]) {
  const now = Date.now();
  const inWindow = (b: Booking, from: number, to: number) =>
    b.status === "CONFIRMED" && b.createdAt >= from && b.createdAt < to;
  const thisWeek = bookings.filter((b) => inWindow(b, now - WEEK_MS, now));
  const lastWeek = bookings.filter((b) => inWindow(b, now - 2 * WEEK_MS, now - WEEK_MS));
  const seats = (list: Booking[]) => list.reduce((s, b) => s + b.seatIds.length, 0);
  const revenue = (list: Booking[]) => list.reduce((s, b) => s + b.amount, 0);
  return {
    registrations: trendOf(thisWeek.length, lastWeek.length),
    revenue: trendOf(revenue(thisWeek), revenue(lastWeek)),
    ticketsSold: trendOf(seats(thisWeek), seats(lastWeek)),
  };
}

export async function AdminDashboardScreen() {
  const currentUser = await requireDashboardPage();

  await sweepStalePending(); // reconcile abandoned checkouts before reporting
  const [events, bookings, recentActivity, soldByEvent] = await Promise.all([
    listEvents(),
    listBookings(),
    listAudit(8),
    getBookedSeatCounts(),
  ]);

  // Aggregate totals across all events (event management now lives at /admin/events).
  const totals = { registrations: 0, revenue: 0, ticketsSold: 0, remaining: 0 };
  for (const event of events) {
    const confirmed = bookings.filter((b) => b.eventId === event.id && b.status === "CONFIRMED");
    const sold = soldByEvent[event.id] ?? 0;
    totals.registrations += confirmed.length;
    totals.revenue += confirmed.reduce((sum, b) => sum + b.amount, 0);
    totals.ticketsSold += sold;
    totals.remaining += totalSeats(event) - sold;
  }

  // Week-over-week trends from confirmed-booking timestamps.
  const trends = weekTrends(bookings);

  return (
    <AdminShell user={{ name: currentUser.name, role: currentUser.role }}>
      <h1 className="font-heading text-3xl font-semibold mb-1">Dashboard</h1>
      <p className="text-sm text-zinc-500 mb-8">
        Live totals across all events. Trends compare the last 7 days with the 7 days before.
      </p>

      {/* Totals */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <Stat
          label="Registrations"
          value={String(totals.registrations)}
          tip="Confirmed (paid) bookings across every event. Each booking is one purchase, which may cover several seats."
          trend={trends.registrations}
        />
        <Stat
          label="Revenue"
          value={inr(totals.revenue)}
          tip="Total amount collected from confirmed bookings, before any refunds are subtracted."
          trend={trends.revenue}
        />
        <Stat
          label="Tickets sold"
          value={String(totals.ticketsSold)}
          tip="Individual seats sold and currently held by confirmed bookings across all events."
          trend={trends.ticketsSold}
        />
        <Stat
          label="Seats remaining"
          value={String(totals.remaining)}
          tip="Seats still available to sell across all events (total capacity minus sold and blocked seats)."
        />
      </div>

      {/* Audit trail: every admin action touching money, bookings or accounts */}
      {currentUser.role === "super_admin" && (
        <section className="mt-12">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            Recent activity
            <InfoTip text="A running log of admin actions that affect money, bookings or accounts. Click any entry to jump to where it's managed." />
          </h2>
          {recentActivity.length > 0 ? (
            <ActivityFeed entries={recentActivity} />
          ) : (
            <div className="border border-dashed border-zinc-800 rounded-xl px-4 py-10 text-center">
              <ClipboardList className="w-8 h-8 mx-auto mb-2 text-zinc-500" aria-hidden="true" />
              <p className="text-sm text-zinc-400">No admin activity yet.</p>
              <p className="text-xs text-zinc-600 mt-1">
                Creating events, issuing refunds and managing admins will show up here.
              </p>
            </div>
          )}
        </section>
      )}
    </AdminShell>
  );
}

function Stat({
  label,
  value,
  tip,
  trend,
}: {
  label: string;
  value: string;
  tip: string;
  trend?: Trend | null;
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <p className="text-xs uppercase tracking-wide text-zinc-500 mb-1 flex items-center gap-1.5">
        {label}
        <InfoTip text={tip} />
      </p>
      <div className="flex items-baseline gap-2">
        <p className="text-2xl font-bold">{value}</p>
        {trend && (
          <span
            className={`text-xs font-semibold ${
              trend.dir === "up" ? "text-emerald-400" : "text-red-400"
            }`}
            title="vs. the previous 7 days"
          >
            {trend.dir === "up" ? "▲" : "▼"} {trend.pct}%
          </span>
        )}
      </div>
    </div>
  );
}
