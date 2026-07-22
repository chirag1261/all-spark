import { notFound, redirect } from "next/navigation";

import BookingFlow from "@/components/BookingFlow";
import SiteHeader from "@/components/SiteHeader";
import { requireCustomerPage } from "@/lib/auth/customer";
import { getBookedSeats, getEvent, getLockedSeats } from "@/lib/db";
import { blockedSeatIds, registrationState, totalSeats } from "@/lib/domain/events";

export async function BookingScreen({ id }: { id: string }) {
  // Booking requires a signed-in customer — also enforced in /api/orders.
  const customer = await requireCustomerPage(`/events/${id}/book`);

  const event = await getEvent(id);
  if (!event || !event.published) notFound();

  // Fetched once here and handed to BookingFlow as initial state, so the seat
  // map already shows booked/held seats on first paint instead of rendering
  // everything as available until the client's first /api/seats poll lands.
  const [booked, locked] = await Promise.all([getBookedSeats(event.id), getLockedSeats(event.id)]);

  // Registration window / sold-out are re-checked server-side in /api/orders;
  // this just keeps people off a dead seat map.
  const soldOut = totalSeats(event) - booked.length <= 0;
  if (registrationState(event) !== "open" || soldOut) redirect(`/events/${event.id}`);

  return (
    <div className="min-h-screen text-zinc-100">
      <SiteHeader />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <BookingFlow
          event={event}
          customer={{ name: customer.name, email: customer.email, phone: customer.phone }}
          initialBookedSeats={[...new Set([...booked, ...blockedSeatIds(event)])]}
          initialLockedSeats={locked}
        />
      </main>
    </div>
  );
}
