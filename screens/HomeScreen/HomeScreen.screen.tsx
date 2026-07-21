import EventLanding from "@/components/EventLanding";
import EventList from "@/components/EventList";
import HomeInfoSections from "@/components/HomeInfoSections";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import { getBookedSeats, listPublishedEvents } from "@/lib/db";
import { totalSeats } from "@/lib/domain/events";

/** Public landing page: a featured event takes over, otherwise a discovery grid. */
export async function HomeScreen() {
  const events = await listPublishedEvents();
  const remaining: Record<string, number> = {};
  for (const event of events) {
    remaining[event.id] = totalSeats(event) - (await getBookedSeats(event.id)).length;
  }

  // A featured event takes over the landing page (admin-controlled).
  const featured = events.find((e) => e.featured);
  const others = events.filter((e) => e.id !== featured?.id);

  return (
    <div className="min-h-screen text-zinc-100">
      <SiteHeader />
      {featured ? (
        <main>
          <EventLanding event={featured} remaining={remaining[featured.id]} />
          {others.length > 0 && (
            <div className="max-w-6xl mx-auto px-4 py-16">
              <EventList events={others} remaining={remaining} title="More events" />
            </div>
          )}
          <HomeInfoSections />
        </main>
      ) : (
        <main>
          <div className="max-w-6xl mx-auto px-4 py-8">
            <EventList events={events} remaining={remaining} />
          </div>
          <HomeInfoSections />
        </main>
      )}
      <SiteFooter />
    </div>
  );
}
