import AccessDenied from "@/components/AccessDenied";
import AdminEventsPanel, { EventRow } from "@/components/AdminEventsPanel";
import AdminShell from "@/components/AdminShell";
import { hasPermission, requireDashboardPage } from "@/lib/auth/admin";
import { getBookedSeatCounts, listBookings, listEvents } from "@/lib/db";
import { registrationState, totalSeats } from "@/lib/domain/events";
import { cloudinaryConfigured } from "@/lib/integrations/cloudinary";

export async function AdminEventsScreen() {
  const currentUser = await requireDashboardPage();
  const shellUser = { name: currentUser.name, role: currentUser.role };

  if (!hasPermission(currentUser, "events")) {
    return (
      <AdminShell user={shellUser}>
        <AccessDenied what="view or manage events" />
      </AdminShell>
    );
  }

  const [events, bookings, sold] = await Promise.all([
    listEvents(),
    listBookings(),
    getBookedSeatCounts(),
  ]);

  const rows: EventRow[] = events.map((event) => {
    const confirmed = bookings.filter((b) => b.eventId === event.id && b.status === "CONFIRMED");
    const total = totalSeats(event);
    return {
      event,
      registrationOpen: registrationState(event),
      registrations: confirmed.length,
      revenue: confirmed.reduce((sum, b) => sum + b.amount, 0),
      remaining: total - (sold[event.id] ?? 0),
      total,
    };
  });

  const noFeatured = events.every((e) => !e.featured);

  return (
    <AdminShell user={shellUser}>
      <h1 className="font-heading text-3xl font-semibold mb-6">Events</h1>
      {noFeatured && (
        <div className="mb-5 flex items-start gap-3 bg-amber-50 border border-amber-400/25 text-amber-700 rounded-xl px-4 py-3 text-sm">
          <span className="shrink-0 mt-0.5">⚠️</span>
          <span>
            No event is set as the <strong>Featured</strong> landing page — the home screen will
            show an empty grid. Edit an event and enable &quot;Featured&quot; to fix this.
          </span>
        </div>
      )}
      <AdminEventsPanel rows={rows} cloudinaryEnabled={cloudinaryConfigured()} />
    </AdminShell>
  );
}
