"use client";

import { useEffect, useState } from "react";

import { User, X } from "lucide-react";
import Link from "next/link";
import { createPortal } from "react-dom";

import { useConfirm } from "../ConfirmDialog";
import { useRouteLoader } from "../RouteLoader";

const MENU = [
  { href: "/account", label: "My Account" },
  { href: "/account/bookings", label: "My Bookings" },
  { href: "/account/transactions", label: "My Transactions" },
  { href: "/account/tickets", label: "My Tickets" },
  { href: "/contact", label: "Contact Us" },
];

/**
 * Public mobile profile/account access — a right-side drawer mirroring the
 * desktop AccountMenu dropdown. Idle-logout itself is already handled by the
 * always-mounted (visually hidden on mobile) desktop AccountMenu instance, so
 * this component doesn't need its own idle-logout listener. Rendered only
 * below `md`.
 */
export default function MobileAccountDrawer({ customerName }: { customerName: string | null }) {
  const [open, setOpen] = useState(false);
  const routeLoader = useRouteLoader();
  const { confirm, dialog } = useConfirm();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const logout = async () => {
    setOpen(false);
    const ok = await confirm({
      title: "Log out",
      message: "Are you sure you want to log out of your account?",
      confirmLabel: "Log out",
      tone: "danger",
    });
    if (!ok) return;
    routeLoader.show("Signing out…");
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    routeLoader.navigate("/", "Signing out…");
  };

  return (
    <div className="md:hidden">
      <button
        onClick={() => setOpen(true)}
        aria-label={customerName ? "Open account menu" : "Sign in"}
        className="w-9 h-9 inline-flex items-center justify-center rounded-full bg-[#1d4ed8]/15 text-[#1d4ed8] font-bold text-xs uppercase"
      >
        {customerName ? customerName.trim().charAt(0) || "?" : <User className="w-4 h-4" aria-hidden="true" />}
      </button>

      {/* Portalled to <body>: the header has backdrop-blur, which creates a
          containing block for fixed descendants — without the portal this
          drawer would be pinned/clipped to the header's box instead of the
          viewport, and render see-through over the page. */}
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
            <button
              aria-label="Close menu"
              onClick={() => setOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs"
            />
            <div className="relative w-72 max-w-[80vw] h-full bg-white border-l border-[#e5eaf1] p-5 flex flex-col animate-[slide-in_.2s_ease-out]">
              <div className="flex items-center justify-between mb-6">
                <span className="font-heading text-lg font-semibold truncate">
                  {customerName ? `Hi, ${customerName}` : "Your account"}
                </span>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="w-8 h-8 shrink-0 inline-flex items-center justify-center rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>

              {customerName ? (
                <>
                  <nav className="flex flex-col gap-1">
                    {MENU.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className="rounded-lg px-3 py-2.5 text-sm text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                      >
                        {item.label}
                      </Link>
                    ))}
                  </nav>
                  <button
                    onClick={logout}
                    className="mt-auto rounded-lg px-3 py-2.5 text-sm text-left text-red-700 hover:bg-slate-100 transition-colors"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <div className="mt-2">
                  <p className="text-sm text-slate-600 mb-4">
                    Sign in to manage your bookings and tickets.
                  </p>
                  <Link
                    href="/login"
                    onClick={() => setOpen(false)}
                    className="block text-center bg-linear-to-r from-[#1d4ed8] to-[#3b82f6] hover:brightness-110 text-white font-semibold rounded-full px-5 py-2.5 transition-all"
                  >
                    Sign in
                  </Link>
                </div>
              )}
            </div>
          </div>,
          document.body
        )}
      {dialog}
    </div>
  );
}
