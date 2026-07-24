import BookingLookup from "@/components/BookingLookup";
import SiteHeader from "@/components/SiteHeader";

export function MyBookingScreen() {
  return (
    <div className="min-h-screen text-slate-900">
      <SiteHeader />
      <main className="max-w-md mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold mb-1">Check your booking</h1>
        <p className="text-sm text-slate-500 mb-8">
          Enter the booking ID from your confirmation along with the email you booked with.
        </p>
        <BookingLookup />
      </main>
    </div>
  );
}
