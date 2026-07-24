import EventLanding from "@/components/EventLanding";
import EventList from "@/components/EventList";
import HomeInfoSections from "@/components/HomeInfoSections";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import { getBookedSeatCounts, listPublishedEvents } from "@/lib/db";
import { totalSeats } from "@/lib/domain/events";

/** Public landing page: a featured event takes over, otherwise a discovery grid. */
export async function HomeScreen() {
  // One aggregate query for all seat counts (not one per event) keeps this fast.
  const [events, sold] = await Promise.all([listPublishedEvents(), getBookedSeatCounts()]);
  const remaining: Record<string, number> = {};
  for (const event of events) {
    remaining[event.id] = totalSeats(event) - (sold[event.id] ?? 0);
  }

  // A featured event takes over the landing page (admin-controlled).
  const featured = events.find((e) => e.featured);
  const others = events.filter((e) => e.id !== featured?.id);

  return (
    <div className="min-h-screen text-slate-900">
      <SiteHeader />
      {featured ? (
        <main>
          <EventLanding event={featured} remaining={remaining[featured.id]} />
          {others.length > 0 && (
            <div className="section-y max-w-6xl mx-auto px-4">
              <EventList events={others} remaining={remaining} title="More events" />
            </div>
          )}
          <HomeInfoSections />
        </main>
      ) : (
        <main>
          <div className="section-y max-w-6xl mx-auto px-4">
            <EventList events={events} remaining={remaining} />
          </div>
          <HomeInfoSections />
        </main>
      )}
      <SiteFooter />
    </div>
  );
}
