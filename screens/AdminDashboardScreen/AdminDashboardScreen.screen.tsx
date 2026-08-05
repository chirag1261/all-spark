import { ClipboardList } from "lucide-react";

import ActivityFeed from "@/components/ActivityFeed";
import AdminShell from "@/components/AdminShell";
import InfoTip from "@/components/InfoTip";
import { requireDashboardPage } from "@/lib/auth/admin";
import {
  getBookedSeatCounts,
  getLockedSeatCounts,
  listAudit,
  listBookings,
  listEvents,
  sweepStalePending,
} from "@/lib/db";
import { registrationState, totalSeats } from "@/lib/domain/events";
import { ATTENDEE_GENDERS, AttendeeGender, Booking } from "@/types";
import { inr } from "@/utils";

const GENDER_LABELS: Record<AttendeeGender, string> = {
  male: "Male",
  female: "Female",
  boy: "Boy",
  girl: "Girl",
  others: "Others",
};
const GENDER_TONES: Record<AttendeeGender, string> = {
  male: "bg-sky-500",
  female: "bg-fuchsia-500",
  boy: "bg-cyan-500",
  girl: "bg-rose-500",
  others: "bg-violet-500",
};

/** Attendee gender tally across every confirmed booking — powers the
 *  dashboard's audience demographics breakdown. Gender is optional per
 *  attendee, so "Not specified" is tracked separately, not silently dropped. */
function genderBreakdown(bookings: Booking[]) {
  const counts: Record<AttendeeGender, number> = { male: 0, female: 0, boy: 0, girl: 0, others: 0 };
  let unspecified = 0;
  for (const b of bookings) {
    if (b.status !== "CONFIRMED") continue;
    for (const a of b.attendees) {
      if (a.gender && a.gender in counts) counts[a.gender]++;
      else unspecified++;
    }
  }
  return { counts, unspecified, total: Object.values(counts).reduce((s, n) => s + n, 0) + unspecified };
}

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

interface RevenueBucket {
  label: string;
  amount: number;
}

/** Confirmed-booking revenue for each of the last `days` calendar days, oldest first. */
function dailyRevenue(bookings: Booking[], days: number): RevenueBucket[] {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const buckets: RevenueBucket[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const from = startOfToday.getTime() - i * DAY_MS;
    const to = from + DAY_MS;
    const amount = bookings
      .filter((b) => b.status === "CONFIRMED" && b.createdAt >= from && b.createdAt < to)
      .reduce((sum, b) => sum + b.amount, 0);
    buckets.push({
      label: new Date(from).toLocaleDateString("en-IN", { weekday: "short", day: "numeric" }),
      amount,
    });
  }
  return buckets;
}

/** Confirmed-booking revenue for each of the last `weeks` 7-day windows, oldest first. */
function weeklyRevenue(bookings: Booking[], weeks: number): RevenueBucket[] {
  const now = Date.now();
  const buckets: RevenueBucket[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const from = now - (i + 1) * WEEK_MS;
    const to = now - i * WEEK_MS;
    const amount = bookings
      .filter((b) => b.status === "CONFIRMED" && b.createdAt >= from && b.createdAt < to)
      .reduce((sum, b) => sum + b.amount, 0);
    buckets.push({
      label: new Date(from).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
      amount,
    });
  }
  return buckets;
}

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
  const [events, bookings, recentActivity, soldByEvent, lockedByEvent] = await Promise.all([
    listEvents(),
    listBookings(),
    listAudit(8),
    getBookedSeatCounts(),
    getLockedSeatCounts(),
  ]);

  // Aggregate totals across all events (event management now lives at /admin/events).
  const totals = { registrations: 0, revenue: 0, ticketsSold: 0, remaining: 0 };
  for (const event of events) {
    const confirmed = bookings.filter((b) => b.eventId === event.id && b.status === "CONFIRMED");
    const sold = soldByEvent[event.id] ?? 0;
    totals.registrations += confirmed.length;
    totals.revenue += confirmed.reduce((sum, b) => sum + b.amount, 0);
    totals.ticketsSold += sold;
    // Seats someone else is mid-checkout on (locked) aren't actually
    // bookable right now either, even though they're not yet confirmed.
    totals.remaining += totalSeats(event) - sold - (lockedByEvent[event.id] ?? 0);
  }

  const refunded = bookings.filter((b) => b.status === "REFUNDED");
  const refundTotal = refunded.reduce((sum, b) => sum + b.amount, 0);
  const activeEvents = events.filter(
    (e) => e.published && registrationState(e) === "open"
  ).length;

  // Week-over-week trends from confirmed-booking timestamps.
  const trends = weekTrends(bookings);
  const daily = dailyRevenue(bookings, 7);
  const weekly = weeklyRevenue(bookings, 8);
  const demographics = genderBreakdown(bookings);

  return (
    <AdminShell user={{ name: currentUser.name, role: currentUser.role }}>
      <h1 className="font-heading text-3xl font-semibold mb-1">Dashboard</h1>
      <p className="text-sm text-slate-800 mb-8">
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
        <Stat
          label="Active events"
          value={String(activeEvents)}
          tip="Published events currently open for booking (registration window is open and hasn't started yet)."
        />
        <Stat
          label="Total events"
          value={String(events.length)}
          tip="Every event on record, including drafts and past/closed events."
        />
        <Stat
          label="Refunds"
          value={String(refunded.length)}
          tip="Bookings that were refunded, with the total amount returned to customers."
          tone="down"
          sub={refunded.length > 0 ? inr(refundTotal) : undefined}
        />
      </div>

      {/* Revenue reports */}
      <div className="grid sm:grid-cols-2 gap-4 mb-10">
        <RevenueReport
          title="Daily revenue"
          tip="Confirmed-booking revenue for each of the last 7 days."
          data={daily}
        />
        <RevenueReport
          title="Weekly revenue"
          tip="Confirmed-booking revenue for each of the last 8 weeks."
          data={weekly}
        />
      </div>

      {/* Audience demographics — gender is optional per attendee at checkout */}
      <div className="mb-10">
        <DemographicsReport demographics={demographics} />
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
            <div className="border border-dashed border-slate-200 rounded-xl px-4 py-10 text-center">
              <ClipboardList className="w-8 h-8 mx-auto mb-2 text-slate-800" aria-hidden="true" />
              <p className="text-sm text-slate-600">No admin activity yet.</p>
              <p className="text-sm text-slate-700 mt-1">
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
  tone,
  sub,
}: {
  label: string;
  value: string;
  tip: string;
  trend?: Trend | null;
  /** "down" tints the value red — for metrics where a higher number is bad (e.g. refunds). */
  tone?: "down";
  /** Small secondary line under the value (e.g. a refunded amount). */
  sub?: string;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <p className="text-sm uppercase tracking-wide text-slate-800 mb-1 flex items-center gap-1.5">
        {label}
        <InfoTip text={tip} />
      </p>
      <div className="flex items-baseline gap-2">
        <p className={`text-2xl font-bold ${tone === "down" && value !== "0" ? "text-red-700" : ""}`}>
          {value}
        </p>
        {trend && (
          <span
            className={`text-sm font-semibold ${
              trend.dir === "up" ? "text-emerald-700" : "text-red-700"
            }`}
            title="vs. the previous 7 days"
          >
            {trend.dir === "up" ? "▲" : "▼"} {trend.pct}%
          </span>
        )}
      </div>
      {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
    </div>
  );
}

function DemographicsReport({
  demographics,
}: {
  demographics: { counts: Record<AttendeeGender, number>; unspecified: number; total: number };
}) {
  const { counts, unspecified, total } = demographics;
  const rows: { label: string; value: number; tone: string }[] = [
    ...ATTENDEE_GENDERS.map((g) => ({ label: GENDER_LABELS[g], value: counts[g], tone: GENDER_TONES[g] })),
    { label: "Not specified", value: unspecified, tone: "bg-slate-300" },
  ];
  const max = Math.max(1, ...rows.map((r) => r.value));

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold flex items-center gap-1.5">
          Audience demographics
          <InfoTip text="Gender is an optional field attendees can fill in at checkout — counted across all confirmed bookings." />
        </h3>
        <span className="text-sm font-bold">{total} attendee{total === 1 ? "" : "s"}</span>
      </div>
      {total === 0 ? (
        <p className="text-sm text-slate-700 text-center py-6">
          No attendee data yet — this fills in as bookings come through.
        </p>
      ) : (
        <div className="space-y-2.5">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center gap-3">
              <span className="w-28 shrink-0 text-xs text-slate-600">{r.label}</span>
              <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className={`h-full rounded-full ${r.tone}`}
                  style={{ width: `${(r.value / max) * 100}%` }}
                />
              </div>
              <span className="w-24 shrink-0 text-xs font-semibold text-right">
                {r.value} ({total > 0 ? Math.round((r.value / total) * 100) : 0}%)
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RevenueReport({
  title,
  tip,
  data,
}: {
  title: string;
  tip: string;
  data: { label: string; amount: number }[];
}) {
  const max = Math.max(1, ...data.map((d) => d.amount));
  const total = data.reduce((sum, d) => sum + d.amount, 0);
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold flex items-center gap-1.5">
          {title}
          <InfoTip text={tip} />
        </h3>
        <span className="text-sm font-bold">{inr(total)}</span>
      </div>
      <div className="space-y-2.5">
        {data.map((d, i) => (
          <div key={`${d.label}-${i}`} className="flex items-center gap-3">
            <span className="w-16 shrink-0 text-xs text-slate-600">{d.label}</span>
            <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full bg-[#1d4ed8] rounded-full"
                style={{ width: `${(d.amount / max) * 100}%` }}
              />
            </div>
            <span className="w-20 shrink-0 text-xs font-semibold text-right">{inr(d.amount)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
