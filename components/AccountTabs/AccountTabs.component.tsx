"use client";

import { useEffect, useRef } from "react";

import Link from "next/link";

const TABS = [
  { href: "/account", label: "My Account" },
  { href: "/account/bookings", label: "My Bookings" },
  { href: "/account/transactions", label: "My Transactions" },
  { href: "/account/tickets", label: "My Tickets" },
];

/**
 * Horizontally-scrollable tab bar. On mobile the tabs can overflow the
 * viewport, so whichever tab is actually active gets scrolled into view
 * (centered) on mount/navigation instead of silently sitting off-screen.
 */
export default function AccountTabs({ active }: { active: string }) {
  const activeRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [active]);

  return (
    <nav className="flex gap-2 overflow-x-auto mb-8 -mx-4 px-4 pb-1">
      {TABS.map((tab) => {
        const isActive = active === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            ref={isActive ? activeRef : undefined}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium border transition-all duration-200 ${
              isActive
                ? "bg-linear-to-r from-[#d99a45] to-[#e8bd6b] border-transparent text-white shadow-lg shadow-[#d99a45]/25"
                : "bg-[#171228] border-[#2a2450] text-zinc-400 hover:text-zinc-100 hover:border-zinc-600"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
