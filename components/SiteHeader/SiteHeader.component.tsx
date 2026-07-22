import Link from "next/link";

import { getCurrentCustomer } from "@/lib/auth/customer";
import { getFeaturedEvent } from "@/lib/db";

import AccountMenu from "../AccountMenu";
import Logo from "../Logo";
import MobileAccountDrawer from "../MobileAccountDrawer";
import MobileMenu, { type NavLink } from "../MobileMenu";

/** Public site header. Admin has no link here — it lives at /admin directly. */
export default async function SiteHeader() {
  const [customer, featured] = await Promise.all([getCurrentCustomer(), getFeaturedEvent()]);

  // The Book Seats CTA points at the featured event's booking page when there
  // is one; otherwise it falls back to the full events listing.
  const bookHref = featured ? `/events/${featured.id}/book` : "/events";

  const links: NavLink[] = [
    { href: "/", label: "Home" },
    { href: "/events", label: "Events" },
    { href: "/about", label: "About" },
    { href: "/contact", label: "Contact" },
  ];

  return (
    <header className="sticky top-0 z-20 bg-[#0d0a1f]/80 backdrop-blur-xl border-b border-white/6 shadow-[0_8px_30px_rgba(0,0,0,0.35)]">
      <div className="relative max-w-6xl mx-auto px-4 h-16 flex items-center gap-3">
        {/* Mobile hamburger — opens the left nav drawer */}
        <MobileMenu links={links} bookHref={bookHref} />

        {/* Left — brand */}
        <Logo />

        {/* Center — primary nav (desktop) */}
        <nav className="hidden md:flex absolute left-1/2 -translate-x-1/2 items-center gap-7 text-sm text-zinc-300">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-zinc-100 transition-colors">
              {l.label}
            </Link>
          ))}
        </nav>

        {/* Right — CTA + auth (desktop) / account drawer (mobile) */}
        <div className="ml-auto flex items-center gap-3">
          <Link
            href={bookHref}
            className="hidden md:inline-block bg-linear-to-r from-[#d99a45] to-[#e8bd6b] hover:brightness-110 text-white font-semibold rounded-full px-5 py-2 shadow-lg shadow-[#d99a45]/25 transition-all"
          >
            Book Seats
          </Link>

          <div className="hidden md:block">
            {customer ? (
              <AccountMenu name={customer.name} />
            ) : (
              <Link
                href="/login"
                className="text-sm text-zinc-400 hover:text-zinc-100 transition-colors"
              >
                Sign in
              </Link>
            )}
          </div>

          {/* Mobile: profile/account drawer (nav + Book Seats live in the left drawer) */}
          <MobileAccountDrawer customerName={customer ? customer.name : null} />
        </div>
      </div>
    </header>
  );
}