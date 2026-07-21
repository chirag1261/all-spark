import { notFound, redirect } from "next/navigation";

import BookingFlow from "@/components/BookingFlow";
import SiteHeader from "@/components/SiteHeader";
import { requireCustomerPage } from "@/lib/auth/customer";
import { getBookedSeats, getEvent } from "@/lib/db";
import { registrationState, totalSeats } from "@/lib/domain/events";

export async function BookingScreen({ id }: { id: string }) {
  // Booking requires a signed-in customer — also enforced in /api/orders.
  const customer = await requireCustomerPage(`/events/${id}/book`);

  const event = await getEvent(id);
  if (!event || !event.published) notFound();

  // Registration window / sold-out are re-checked server-side in /api/orders;
  // this just keeps people off a dead seat map.
  const soldOut = totalSeats(event) - (await getBookedSeats(event.id)).length <= 0;
  if (registrationState(event) !== "open" || soldOut) redirect(`/events/${event.id}`);

  return (
    <div className="min-h-screen text-zinc-100">
      <SiteHeader />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <BookingFlow
          event={event}
          customer={{ name: customer.name, email: customer.email, phone: customer.phone }}
        />
      </main>
    </div>
  );
}
