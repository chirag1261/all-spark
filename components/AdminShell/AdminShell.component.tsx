"use client";

import { useState } from "react";

import { useIdleLogout } from "@/lib/hooks/useIdleLogout";

import {
  CalendarDays,
  ChevronDown,
  ExternalLink,
  LayoutDashboard,
  LogOut,
  type LucideIcon,
  Menu,
  ScanLine,
  Tag,
  Ticket,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { AdminRole } from "@/types";

import { useConfirm } from "../ConfirmDialog";
import { useRouteLoader } from "../RouteLoader";

interface NavItem {
  title: string;
  href?: string;
  icon: LucideIcon;
  /** Roles allowed to see this item. Omitted ⇒ super admins + regular admins
   *  (i.e. everything except scanner-only gate staff). */
  roles?: AdminRole[];
  /** When present, this is an expandable controller with sub-screens. */
  items?: { title: string; href: string }[];
}
interface NavSection {
  label: string;
  items: NavItem[];
}

const ALL_ROLES: AdminRole[] = ["super_admin", "admin", "gate_controller"];

// Left-sidebar structure mirroring admin-ui-primus: uppercase group labels,
// icon + title items, expandable controllers with sub-screens, active
// highlighting. Items are gated by role via `roles`.
const NAV: NavSection[] = [
  {
    label: "Overview",
    items: [{ title: "Dashboard", href: "/admin", icon: LayoutDashboard }],
  },
  {
    label: "Management",
    items: [
      {
        title: "Events",
        icon: CalendarDays,
        items: [
          { title: "View events", href: "/admin/events" },
          { title: "Create event", href: "/admin/events/new" },
        ],
      },
      { title: "Bookings", href: "/admin/bookings", icon: Ticket },
      {
        title: "Promo codes",
        icon: Tag,
        items: [
          { title: "View promo codes", href: "/admin/promocodes" },
          { title: "Create promo code", href: "/admin/promocodes/new" },
        ],
      },
      { title: "Admin users", href: "/admin/users", icon: Users, roles: ["super_admin"] },
    ],
  },
  {
    label: "Entry",
    items: [
      {
        title: "Scanner",
        icon: ScanLine,
        roles: ALL_ROLES,
        items: [
          { title: "Scan tickets", href: "/admin/scan" },
          { title: "Attendance", href: "/admin/attendance" },
        ],
      },
    ],
  },
];

interface Props {
  user: { name: string; role: AdminRole };
  children: React.ReactNode;
}

export default function AdminShell({ user, children }: Props) {
  const pathname = usePathname();
  const routeLoader = useRouteLoader();
  const { confirm, dialog } = useConfirm();
  const [open, setOpen] = useState(false); // mobile drawer
  const [expanded, setExpanded] = useState<string[]>([]); // expanded controllers

  const roleLabel =
    user.role === "super_admin"
      ? "Super admin"
      : user.role === "gate_controller"
        ? "Gate staff"
        : "Admin";
  const canSee = (item: NavItem) =>
    !item.roles ? user.role !== "gate_controller" : item.roles.includes(user.role);

  const logout = async () => {
    const ok = await confirm({
      title: "Log out",
      message: "Are you sure you want to log out of the admin dashboard?",
      confirmLabel: "Log out",
      tone: "danger",
    });
    if (!ok) return;
    routeLoader.show("Signing out…");
    await fetch("/api/admin/logout", { method: "POST" }).catch(() => {});
    routeLoader.navigate("/admin/login", "Signing out…");
  };

  const idleLogout = async () => {
    routeLoader.show("Signing out…");
    await fetch("/api/admin/logout", { method: "POST" }).catch(() => {});
    routeLoader.navigate("/admin/login?reason=idle", "Signing out…");
  };
  useIdleLogout(idleLogout);

  const sidebar = (
    <div className="flex h-full flex-col bg-white border-r border-[#e5eaf1]">
      {/* Brand */}
      <div className="h-16 flex items-center gap-2.5 px-5 border-b border-[#e5eaf1] shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://res.cloudinary.com/cih7cika/image/upload/f_auto,q_auto,w_240/utsav-events/logo"
          alt=""
          className="h-8 w-8 object-contain"
        />
        <span className="font-heading text-xl font-semibold leading-none">
          Utsav{" "}
          <span className="text-transparent bg-clip-text bg-linear-to-r from-[#1d4ed8] to-[#3b82f6]">
            Events
          </span>
          <span className="ml-1.5 text-[10px] font-sans font-semibold uppercase text-slate-500 align-super">
            admin
          </span>
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-5 space-y-6">
        {NAV.map((section) => {
          const items = section.items.filter(canSee);
          if (!items.length) return null;
          return (
            <div key={section.label}>
              <p className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                {section.label}
              </p>
              <ul className="space-y-1">
                {items.map((item) => {
                  const Icon = item.icon;

                  // Expandable controller with sub-screens
                  if (item.items) {
                    const childActive = item.items.some((s) => pathname === s.href);
                    const isOpen = expanded.includes(item.title) || childActive;
                    return (
                      <li key={item.title}>
                        <button
                          type="button"
                          onClick={() =>
                            setExpanded((prev) =>
                              prev.includes(item.title)
                                ? prev.filter((t) => t !== item.title)
                                : [...prev, item.title]
                            )
                          }
                          className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                            childActive
                              ? "text-[#1d4ed8]"
                              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                          }`}
                        >
                          <Icon className="w-5 h-5 shrink-0" aria-hidden="true" />
                          {item.title}
                          <ChevronDown
                            className={`ml-auto w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
                            aria-hidden="true"
                          />
                        </button>
                        {isOpen && (
                          <ul className="mt-1 ml-6.5 border-l border-[#e5eaf1] space-y-1">
                            {item.items.map((sub) => {
                              const active = pathname === sub.href;
                              return (
                                <li key={sub.href}>
                                  <Link
                                    href={sub.href}
                                    onClick={() => setOpen(false)}
                                    data-active={active}
                                    className={`block rounded-lg pl-4 pr-3 py-2 text-sm transition-colors ${
                                      active
                                        ? "text-[#1d4ed8] font-medium"
                                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                                    }`}
                                  >
                                    {sub.title}
                                  </Link>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </li>
                    );
                  }

                  // Flat link
                  const active = pathname === item.href;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href!}
                        onClick={() => setOpen(false)}
                        data-active={active}
                        className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                          active
                            ? "bg-[#1d4ed8]/15 text-[#1d4ed8]"
                            : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                        }`}
                      >
                        <Icon className="w-5 h-5 shrink-0" aria-hidden="true" />
                        {item.title}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      {/* Footer: view site + logout */}
      <div className="border-t border-[#e5eaf1] p-3 space-y-1 shrink-0">
        <Link
          href="/"
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
        >
          <ExternalLink className="w-5 h-5 shrink-0" aria-hidden="true" />
          View site
        </Link>
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-600 hover:text-red-700 hover:bg-slate-100 transition-colors"
        >
          <LogOut className="w-5 h-5 shrink-0" aria-hidden="true" />
          Log out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex text-slate-900">
      {/* Desktop sidebar */}
      <aside className="hidden lg:block w-[260px] shrink-0 sticky top-0 h-screen">{sidebar}</aside>

      {/* Mobile drawer */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <button
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-xs"
          />
          <div className="relative w-[260px] h-full animate-[slide-in_.2s_ease-out]">{sidebar}</div>
        </div>
      )}

      {/* Content column */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Topbar */}
        <header className="h-16 shrink-0 sticky top-0 z-30 flex items-center gap-3 px-4 sm:px-6 bg-white/90 backdrop-blur border-b border-[#e5eaf1]">
          <button
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            className="lg:hidden w-9 h-9 inline-flex items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-sm text-slate-700 hidden sm:block">{user.name}</span>
            <span className="text-[10px] font-bold uppercase tracking-wide bg-[#1d4ed8]/15 text-[#1d4ed8] px-2 py-0.5 rounded">
              {roleLabel}
            </span>
            <span className="w-8 h-8 rounded-full bg-[#1d4ed8]/20 text-[#1d4ed8] font-bold text-sm flex items-center justify-center uppercase">
              {user.name.trim().charAt(0) || "?"}
            </span>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="max-w-6xl mx-auto">{children}</div>
        </main>
      </div>
      {dialog}
    </div>
  );
}
