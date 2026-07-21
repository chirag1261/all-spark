import SiteHeader from "@/components/SiteHeader";

export function ContactScreen() {
  return (
    <div className="min-h-screen text-zinc-100">
      <SiteHeader />
      <main className="max-w-2xl mx-auto px-4 py-12">
        <h1 className="text-2xl font-bold mb-2">Contact Us</h1>
        <p className="text-zinc-400 mb-8">
          Questions about a booking, refund or event? We usually reply within a few hours.
        </p>

        <div className="grid sm:grid-cols-2 gap-4">
          <a
            href="mailto:utsavevents.tech@gmail.com"
            className="bg-[#171228] border border-[#2a2450] hover:border-[#f5a524]/60 hover:-translate-y-0.5 rounded-2xl p-6 transition-all duration-300"
          >
            <p className="text-xs uppercase tracking-widest text-zinc-500 mb-1">Email</p>
            <p className="font-semibold wrap-break-word">utsavevents.tech@gmail.com</p>
          </a>
          <a
            href="tel:+919876543210"
            className="bg-[#171228] border border-[#2a2450] hover:border-[#f5a524]/60 hover:-translate-y-0.5 rounded-2xl p-6 transition-all duration-300"
          >
            <p className="text-xs uppercase tracking-widest text-zinc-500 mb-1">Phone</p>
            <p className="font-semibold">+91 98765 43210</p>
            <p className="text-xs text-zinc-500 mt-1">Mon–Sat, 10am–7pm IST</p>
          </a>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mt-4">
          <p className="text-xs uppercase tracking-widest text-zinc-500 mb-2">
            Before you reach out
          </p>
          <ul className="text-sm text-zinc-400 space-y-1.5 list-disc list-inside">
            <li>
              Keep your booking ID (BKG…) handy — it&apos;s in your confirmation email and under My
              Bookings.
            </li>
            <li>Refunds take 5–7 working days to reach your payment method.</li>
            <li>
              Each attendee&apos;s ticket QR is individual — forwarding a ticket link shares that
              seat only.
            </li>
          </ul>
        </div>
      </main>
    </div>
  );
}
