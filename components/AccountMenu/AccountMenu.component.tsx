"use client";

import { useEffect, useRef, useState } from "react";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useConfirm } from "../ConfirmDialog";

const MENU = [
  { href: "/account", label: "My Account" },
  { href: "/account/bookings", label: "My Bookings" },
  { href: "/account/transactions", label: "My Transactions" },
  { href: "/account/tickets", label: "My Tickets" },
  { href: "/contact", label: "Contact Us" },
];

/** Header dropdown for a signed-in customer. */
export default function AccountMenu({ name }: { name: string }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { confirm, dialog } = useConfirm();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
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
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.push("/");
    router.refresh();
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-2 text-sm text-zinc-300 hover:text-zinc-100"
      >
        <span className="w-7 h-7 rounded-full bg-[#d99a45]/20 text-[#d99a45] font-bold text-xs flex items-center justify-center uppercase">
          {name.trim().charAt(0) || "?"}
        </span>
        <span className="hidden sm:block max-w-28 truncate">{name}</span>
        <ChevronDown className="w-3.5 h-3.5 text-zinc-500" aria-hidden="true" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-52 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl py-1.5 z-30 animate-[dialog-in_.12s_ease-out]">
          {MENU.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="block px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
            >
              {item.label}
            </Link>
          ))}
          <div className="border-t border-zinc-800 my-1.5" />
          <button
            onClick={logout}
            className="block w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-zinc-800"
          >
            Logout
          </button>
        </div>
      )}
      {dialog}
    </div>
  );
}
