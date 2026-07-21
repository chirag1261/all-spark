import Link from "next/link";

import { getCurrentCustomer } from "@/lib/auth/customer";

import AccountMenu from "../AccountMenu";
import Logo from "../Logo";

/** Public site header. Admin has no link here — it lives at /admin directly. */
export default async function SiteHeader() {
  const customer = await getCurrentCustomer();

  return (
    <header className="sticky top-0 z-20 bg-[#0d0f12]/80 backdrop-blur-xl border-b border-white/6 shadow-[0_8px_30px_rgba(0,0,0,0.35)]">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center gap-4">
        <Logo />
        <nav className="ml-auto flex items-center gap-5 text-sm text-zinc-400">
          <Link href="/" className="hover:text-zinc-100 transition-colors">
            Events
          </Link>
          <Link href="/contact" className="hidden sm:block hover:text-zinc-100 transition-colors">
            Contact Us
          </Link>
          {customer ? (
            <AccountMenu name={customer.name} />
          ) : (
            <Link
              href="/login"
              className="bg-linear-to-r from-[#f84464] to-[#ff2e63] hover:brightness-110 text-white font-semibold rounded-full px-5 py-2 shadow-lg shadow-[#f84464]/25 transition-all"
            >
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
