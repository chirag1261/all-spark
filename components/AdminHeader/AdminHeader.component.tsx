"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { AdminRole } from "@/types";

import { useConfirm } from "../ConfirmDialog";
import Logo from "../Logo";

interface Props {
  currentUser: { name: string; role: AdminRole };
}

export default function AdminHeader({ currentUser }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const { confirm, dialog } = useConfirm();

  const links = [
    { href: "/admin", label: "Dashboard" },
    { href: "/admin/bookings", label: "Bookings" },
    ...(currentUser.role === "super_admin" ? [{ href: "/admin/users", label: "Users" }] : []),
  ];

  const logout = async () => {
    const ok = await confirm({
      title: "Log out",
      message: "Are you sure you want to log out of the admin dashboard?",
      confirmLabel: "Log out",
      tone: "danger",
    });
    if (!ok) return;
    await fetch("/api/admin/logout", { method: "POST" }).catch(() => {});
    router.push("/admin/login");
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-20 bg-zinc-950/90 backdrop-blur border-b border-zinc-800">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center gap-6">
        <Logo href="/admin" admin />
        <nav className="flex items-center gap-4 text-sm">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={
                pathname === l.href
                  ? "text-zinc-100 font-semibold"
                  : "text-zinc-400 hover:text-zinc-100"
              }
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-4 text-sm">
          <span className="hidden sm:flex items-center gap-1.5 text-zinc-500">
            {currentUser.name}
            <span className="text-[10px] font-bold uppercase tracking-wide bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded">
              {currentUser.role === "super_admin" ? "Super admin" : "Admin"}
            </span>
          </span>
          <Link href="/" className="text-zinc-400 hover:text-zinc-100">
            View site
          </Link>
          <button onClick={logout} className="text-zinc-400 hover:text-red-400">
            Log out
          </button>
        </div>
      </div>
      {dialog}
    </header>
  );
}
