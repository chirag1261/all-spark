"use client";

import { useEffect, useState } from "react";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { createPortal } from "react-dom";

export interface NavLink {
  href: string;
  label: string;
}

interface Props {
  links: NavLink[];
  /** Where the "Book Seats" CTA points. */
  bookHref: string;
}

/**
 * Public mobile nav — a hamburger that opens a LEFT-side drawer with the same
 * links as the desktop header plus the Book Seats CTA. Profile/account access
 * lives in the separate right-side MobileAccountDrawer. Rendered only below `md`.
 */
export default function MobileMenu({ links, bookHref }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        className="w-9 h-9 inline-flex items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100"
      >
        <Menu className="w-5 h-5" aria-hidden="true" />
      </button>

      {/* Portalled to <body>: the header has backdrop-blur, which creates a
          containing block for fixed descendants — without the portal this
          drawer would be pinned/clipped to the header's box instead of the
          viewport, and render see-through over the page. */}
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-50 flex justify-start" role="dialog" aria-modal="true">
            <button
              aria-label="Close menu"
              onClick={() => setOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs"
            />
            <div className="relative w-72 max-w-[80vw] h-full bg-white border-r border-[#e5eaf1] p-5 flex flex-col animate-[slide-in-left_.2s_ease-out]">
              <div className="flex items-center justify-between mb-6">
                <span className="font-heading text-lg font-semibold">Menu</span>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>

              <nav className="flex flex-col gap-1">
                {links.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className="rounded-lg px-3 py-2.5 text-sm text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                  >
                    {l.label}
                  </Link>
                ))}
              </nav>

              <div className="mt-auto pt-5 border-t border-[#e5eaf1]">
                <Link
                  href={bookHref}
                  onClick={() => setOpen(false)}
                  className="block text-center bg-linear-to-r from-[#1d4ed8] to-[#3b82f6] hover:brightness-110 text-white font-semibold rounded-full px-5 py-2.5 shadow-lg shadow-[#1d4ed8]/25 transition-all"
                >
                  Book Seats
                </Link>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
