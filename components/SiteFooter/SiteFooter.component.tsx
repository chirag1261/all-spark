import Link from "next/link";

// In a plain module function, not the component body (calling Date in render is
// flagged as impure by react-hooks/purity).
function currentYear(): number {
  return new Date().getFullYear();
}

/** Shared public-site footer — brand, quick links and support contact. */
export default function SiteFooter() {
  return (
    <footer className="bg-[#081A3A] text-[#F8F4E8]/80">
      <div className="max-w-6xl mx-auto px-4 py-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-2 max-w-sm">
          <p className="font-heading text-2xl font-semibold tracking-tight text-transparent bg-clip-text bg-linear-to-r from-[#B68A2E] to-[#E6C35C]">
            Utsav{" "}
            <span className="text-transparent bg-clip-text bg-linear-to-r from-[#B68A2E] to-[#E6C35C]">
              Events
            </span>
          </p>
          <p className="font-heading text-lg text-white mt-2">॥ संगीत ही ईश्वर है ॥</p>
          <p className="text-sm text-[#F8F4E8]/85 mt-3 leading-relaxed">
            A Bangalore-based cultural organisation bringing communities together through the
            timeless power of music and devotion — pick your exact seat, book securely and receive
            an individual QR ticket for every attendee.
          </p>
        </div>

        <div>
          <p className="text-xs uppercase tracking-widest text-[#F8F4E8]/70 mb-3">Explore</p>
          <ul className="space-y-2 text-sm text-[#F8F4E8]/85">
            <li>
              <Link href="/events" className="hover:text-[#F8F4E8] transition-colors">
                All events
              </Link>
            </li>
            <li>
              <Link href="/about" className="hover:text-[#F8F4E8] transition-colors">
                About us
              </Link>
            </li>
            <li>
              <Link href="/organizers" className="hover:text-[#F8F4E8] transition-colors">
                Organizers
              </Link>
            </li>
            <li>
              <Link href="/my-booking" className="hover:text-[#F8F4E8] transition-colors">
                Find my booking
              </Link>
            </li>
            <li>
              <Link href="/contact" className="hover:text-[#F8F4E8] transition-colors">
                Contact us
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <p className="text-xs uppercase tracking-widest text-[#F8F4E8]/70 mb-3">Legal</p>
          <ul className="space-y-2 text-sm text-[#F8F4E8]/85">
            <li>
              <Link href="/terms" className="hover:text-[#F8F4E8] transition-colors">
                Terms &amp; Conditions
              </Link>
            </li>
            <li>
              <Link href="/privacy-policy" className="hover:text-[#F8F4E8] transition-colors">
                Privacy Policy
              </Link>
            </li>
            <li>
              <Link href="/refund-policy" className="hover:text-[#F8F4E8] transition-colors">
                Refund &amp; Cancellation
              </Link>
            </li>
            <li>
              <Link href="/cookie-policy" className="hover:text-[#F8F4E8] transition-colors">
                Cookie Policy
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <p className="text-xs uppercase tracking-widest text-[#F8F4E8]/70 mb-3">Support</p>
          <ul className="space-y-2 text-sm text-[#F8F4E8]/85">
            <li>
              <a
                href="mailto:contact@utsavevents.live"
                className="hover:text-[#F8F4E8] transition-colors wrap-break-word"
              >
                contact@utsavevents.live
              </a>
            </li>
            <li>
              <a
                href="mailto:bookings@utsavevents.live"
                className="hover:text-[#F8F4E8] transition-colors wrap-break-word"
              >
                bookings@utsavevents.live
              </a>
            </li>
            <li>
              <a
                href="mailto:feedback@utsavevents.live"
                className="hover:text-[#F8F4E8] transition-colors wrap-break-word"
              >
                feedback@utsavevents.live
              </a>
            </li>
            <li className="text-[#F8F4E8]/70">Mon–Sat, 10am–7pm IST</li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="max-w-6xl mx-auto px-4 py-5 flex flex-col sm:flex-row items-center gap-2 justify-between text-xs text-[#F8F4E8]/70">
          <p>© {currentYear()} Utsav Events. All rights reserved.</p>
          <p>Secure payments powered by Razorpay.</p>
        </div>
      </div>
    </footer>
  );
}
