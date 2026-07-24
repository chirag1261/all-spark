import EventList from "@/components/EventList";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import { getBookedSeatCounts, listPublishedEvents } from "@/lib/db";
import { totalSeats } from "@/lib/domain/events";

/** Full discovery grid — every published event as a card (incl. the featured one). */
export async function EventsScreen() {
  // One aggregate query for all seat counts (not one per event) keeps this fast.
  const [events, sold] = await Promise.all([listPublishedEvents(), getBookedSeatCounts()]);
  const remaining: Record<string, number> = {};
  for (const event of events) {
    remaining[event.id] = totalSeats(event) - (sold[event.id] ?? 0);
  }

  return (
    <div className="min-h-screen text-slate-900">
      <SiteHeader />
      <main className="max-w-6xl mx-auto px-4 py-10">
        <p className="font-heading text-[#1d4ed8] text-lg">Discover</p>
        <h1 className="font-heading text-3xl sm:text-5xl font-semibold mb-8">All Events</h1>
        {events.length === 0 ? (
          <p className="text-slate-500 py-16 text-center">
            No events are on sale right now — check back soon.
          </p>
        ) : (
          <EventList events={events} remaining={remaining} title="Upcoming events" />
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
