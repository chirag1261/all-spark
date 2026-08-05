import EventList from "@/components/EventList";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import { getBookedSeatCounts, getLockedSeatCounts, listPublishedEvents } from "@/lib/db";
import { totalSeats } from "@/lib/domain/events";

/** Full discovery grid — every published event as a card (incl. the featured one). */
export async function EventsScreen() {
  // One aggregate query for all seat counts (not one per event) keeps this fast.
  const [events, sold, locked] = await Promise.all([
    listPublishedEvents(),
    getBookedSeatCounts(),
    getLockedSeatCounts(),
  ]);
  const remaining: Record<string, number> = {};
  for (const event of events) {
    // Seats someone else is mid-checkout on (locked) aren't actually
    // bookable right now either, even though they're not yet confirmed.
    remaining[event.id] =
      totalSeats(event) - (sold[event.id] ?? 0) - (locked[event.id] ?? 0);
  }

  const cities = new Set(events.map((e) => e.city).filter(Boolean));

  return (
    <div className="min-h-screen text-slate-900">
      <SiteHeader />
      <main className="max-w-6xl mx-auto px-4 py-10">
        {/* Page header — single cohesive block (eyebrow · title · summary) */}
        <header className="border-b border-[#e5eaf1] pb-6 mb-8">
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#1d4ed8] mb-2">
            <span className="w-6 h-px bg-[#1d4ed8]" /> Discover
          </p>
          <h1 className="font-heading text-3xl sm:text-5xl font-semibold tracking-tight">
            All Events
          </h1>
          {events.length > 0 && (
            <p className="text-sm text-slate-500 mt-3">
              {events.length} event{events.length > 1 ? "s" : ""} on sale
              {cities.size > 0 && (
                <>
                  {" "}
                  across {cities.size} cit{cities.size > 1 ? "ies" : "y"}
                </>
              )}
              .
            </p>
          )}
        </header>
        {events.length === 0 ? (
          <p className="text-slate-500 py-16 text-center">
            No events are on sale right now — check back soon.
          </p>
        ) : (
          <EventList events={events} remaining={remaining} showTitle={false} />
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
