import Link from "next/link";

// In a plain module function, not the component body (calling Date in render is
// flagged as impure by react-hooks/purity).
function currentYear(): number {
  return new Date().getFullYear();
}

/** Shared public-site footer — brand, quick links and support contact. */
export default function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-white/6 bg-[#0d0f12]">
      <div className="max-w-6xl mx-auto px-4 py-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2 max-w-sm">
          <p className="text-xl font-extrabold tracking-tight">
            Utsav{" "}
            <span className="text-transparent bg-clip-text bg-linear-to-r from-[#f84464] to-[#ff2e63]">
              Events
            </span>
          </p>
          <p className="text-sm text-zinc-400 mt-3 leading-relaxed">
            Book concerts, comedy nights and live events across India — pick your exact seats, pay
            securely and get an individual QR ticket for every attendee.
          </p>
        </div>

        <div>
          <p className="text-xs uppercase tracking-widest text-zinc-500 mb-3">Explore</p>
          <ul className="space-y-2 text-sm text-zinc-400">
            <li>
              <Link href="/" className="hover:text-zinc-100 transition-colors">
                All events
              </Link>
            </li>
            <li>
              <Link href="/my-booking" className="hover:text-zinc-100 transition-colors">
                Find my booking
              </Link>
            </li>
            <li>
              <Link href="/contact" className="hover:text-zinc-100 transition-colors">
                Contact us
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <p className="text-xs uppercase tracking-widest text-zinc-500 mb-3">Support</p>
          <ul className="space-y-2 text-sm text-zinc-400">
            <li>
              <a
                href="mailto:utsavevents.tech@gmail.com"
                className="hover:text-zinc-100 transition-colors wrap-break-word"
              >
                utsavevents.tech@gmail.com
              </a>
            </li>
            <li className="text-zinc-500">Mon–Sat, 10am–7pm IST</li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/6">
        <div className="max-w-6xl mx-auto px-4 py-5 flex flex-col sm:flex-row items-center gap-2 justify-between text-xs text-zinc-500">
          <p>© {currentYear()} Utsav Events. All rights reserved.</p>
          <p>Secure payments powered by Razorpay.</p>
        </div>
      </div>
    </footer>
  );
}
