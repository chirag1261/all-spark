"use client";

import { useState } from "react";

import { useSearchParams } from "next/navigation";

import BackLink from "@/components/BackLink";
import { useRouteLoader } from "@/components/RouteLoader";
import { useToast } from "@/components/Toast";

export function AdminLoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const { showToast, toast } = useToast();
  const routeLoader = useRouteLoader();
  const searchParams = useSearchParams();
  const idleExpired = searchParams.get("reason") === "idle";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error ?? "Login failed", "error");
        setBusy(false);
        return;
      }
      routeLoader.navigate("/admin", "Loading dashboard…");
    } catch {
      showToast("Could not reach the server", "error");
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex text-zinc-100">
      {/* LEFT — brand panel (desktop only) */}
      <div className="hidden md:flex flex-1 flex-col items-center justify-center gap-6 bg-[#171228] p-10 border-r border-[#2a2450]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://res.cloudinary.com/cih7cika/image/upload/f_auto,q_auto,w_400/utsav-events/logo"
          alt="Utsav Events"
          className="max-h-56 w-auto object-contain drop-shadow-[0_10px_40px_rgba(217,154,69,0.25)]"
        />
        <div className="text-center">
          <p className="font-heading text-3xl font-semibold">
            Utsav{" "}
            <span className="text-transparent bg-clip-text bg-linear-to-r from-[#d99a45] to-[#e8bd6b]">
              Events
            </span>
          </p>
          <span className="inline-block mt-3 text-[11px] font-bold uppercase tracking-widest bg-[#d99a45]/15 text-[#e8bd6b] px-3 py-1 rounded-full">
            Admin dashboard
          </span>
          <p className="font-heading text-lg text-[#d99a45]/90 mt-4">॥ संगीत ही ईश्वर है ॥</p>
        </div>
      </div>

      {/* RIGHT — sign-in card */}
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-10 bg-[#0d0a1f]">
        {/* Logo + label (mobile only — the brand panel is hidden below md) */}
        <div className="md:hidden flex flex-col items-center gap-3 mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://res.cloudinary.com/cih7cika/image/upload/f_auto,q_auto,w_240/utsav-events/logo"
            alt="Utsav Events"
            className="h-14 w-14 object-contain"
          />
          <p className="font-heading text-2xl font-semibold leading-none">
            Utsav{" "}
            <span className="text-transparent bg-clip-text bg-linear-to-r from-[#d99a45] to-[#e8bd6b]">
              Events
            </span>
          </p>
          <span className="text-[11px] font-bold uppercase tracking-widest bg-[#d99a45]/15 text-[#e8bd6b] px-3 py-1 rounded-full">
            Admin dashboard
          </span>
        </div>

        <form
          onSubmit={submit}
          className="w-full max-w-md bg-[#171228] border border-[#2a2450] rounded-2xl p-8 shadow-[0_24px_60px_rgba(0,0,0,0.45)]"
        >
          <h1 className="font-heading text-3xl font-semibold mb-1">Sign in</h1>
          <p className="text-sm text-zinc-500 mb-7">Access the Utsav Events admin dashboard.</p>
          {idleExpired && (
            <p className="text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-lg px-3 py-2 mb-5">
              Your session expired due to inactivity. Please sign in again.
            </p>
          )}

          <label className="block text-xs text-zinc-500 mb-1.5">Email</label>
          <input
            type="email"
            name="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            autoFocus
            className="w-full bg-[#0d0a1f] border border-[#2a2450] rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#d99a45] mb-4"
          />

          <label className="block text-xs text-zinc-500 mb-1.5">Password</label>
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            required
            className="w-full bg-[#0d0a1f] border border-[#2a2450] rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#d99a45] mb-7"
          />

          <button
            type="submit"
            disabled={busy || !email || !password}
            className="w-full bg-[#d99a45] hover:bg-[#bf863a] text-[#1a1206] disabled:opacity-40 rounded-lg px-6 py-3 font-semibold text-sm transition-colors"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>

          <p className="flex justify-center mt-6">
            <BackLink href="/" className="text-zinc-500 hover:text-zinc-300">
              Back to site
            </BackLink>
          </p>
        </form>
      </div>
      {toast}
    </div>
  );
}
