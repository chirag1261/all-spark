import { notFound, redirect } from "next/navigation";

import BookingFlow from "@/components/BookingFlow";
import SiteHeader from "@/components/SiteHeader";
import { getCurrentCustomer } from "@/lib/auth/customer";
import { getBookedSeats, getEvent, getLockedSeats } from "@/lib/db";
import { registrationState, totalSeats } from "@/lib/domain/events";

export async function BookingScreen({ id }: { id: string }) {
  // Seat selection no longer requires being signed in — auth is only asked
  // for at the "Proceed to checkout" step (see BookingFlow). Actual purchase
  // is still enforced server-side in /api/orders regardless of what the
  // client claims here.
  const customer = await getCurrentCustomer();

  const event = await getEvent(id);
  if (!event || !event.published) notFound();

  // Fetched once here and handed to BookingFlow as initial state, so the seat
  // map already shows booked/held seats on first paint instead of rendering
  // everything as available until the client's first /api/seats poll lands.
  const [booked, locked] = await Promise.all([getBookedSeats(event.id), getLockedSeats(event.id)]);

  // Registration window / sold-out are re-checked server-side in /api/orders;
  // this just keeps people off a dead seat map. Locked (mid-checkout) seats
  // count toward "sold out" here too — if every remaining seat is currently
  // held by someone else, there's nothing this customer could actually pick.
  const soldOut = totalSeats(event) - booked.length - locked.length <= 0;
  if (registrationState(event) !== "open" || soldOut) redirect(`/events/${event.id}`);

  return (
    <div className="min-h-screen text-slate-900">
      <SiteHeader />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <BookingFlow
          event={event}
          customer={
            customer ? { name: customer.name, email: customer.email, phone: customer.phone } : null
          }
          // Confirmed-sold seats ONLY — blocked seats are already rendered as
          // unavailable independently via each seat's own `blocked` flag (see
          // SeatMap), so folding them in here too would double-subtract them
          // from the "remaining" count (totalSeats() already excludes them).
          initialBookedSeats={booked}
          initialLockedSeats={locked}
        />
      </main>
    </div>
  );
}
