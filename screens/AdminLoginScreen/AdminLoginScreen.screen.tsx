"use client";

import { useState } from "react";

import { useSearchParams } from "next/navigation";

import BackLink from "@/components/BackLink";
import PasswordInput from "@/components/PasswordInput";
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
    <div className="min-h-screen flex text-slate-900">
      {/* LEFT — brand panel (desktop only) */}
      <div className="hidden md:flex flex-1 flex-col items-center justify-center gap-6 bg-white p-10 border-r border-[#e5eaf1]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://res.cloudinary.com/cih7cika/image/upload/f_auto,q_auto,w_400/utsav-events/logo"
          alt="Utsav Events"
          className="max-h-56 w-auto object-contain drop-shadow-[0_10px_40px_rgba(29,78,216,0.25)]"
        />
        <div className="text-center">
          <p className="font-heading text-3xl font-semibold">
            Utsav{" "}
            <span className="text-transparent bg-clip-text bg-linear-to-r from-[#1d4ed8] to-[#3b82f6]">
              Events
            </span>
          </p>
          <span className="inline-block mt-3 text-[11px] font-bold uppercase tracking-widest bg-[#1d4ed8]/15 text-[#1d4ed8] px-3 py-1 rounded-full">
            Admin dashboard
          </span>
          <p className="font-heading text-lg text-[#1d4ed8]/90 mt-4">॥ संगीत ही ईश्वर है ॥</p>
        </div>
      </div>

      {/* RIGHT — sign-in card */}
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-10 bg-white">
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
            <span className="text-transparent bg-clip-text bg-linear-to-r from-[#1d4ed8] to-[#3b82f6]">
              Events
            </span>
          </p>
          <span className="text-[11px] font-bold uppercase tracking-widest bg-[#1d4ed8]/15 text-[#1d4ed8] px-3 py-1 rounded-full">
            Admin dashboard
          </span>
        </div>

        <form
          onSubmit={submit}
          className="w-full max-w-md bg-white border border-[#e5eaf1] rounded-2xl p-8 shadow-[0_16px_40px_rgba(15,23,42,0.10)]"
        >
          <h1 className="font-heading text-3xl font-semibold mb-1">Sign in</h1>
          <p className="text-sm text-slate-800 mb-7">Access the Utsav Events admin dashboard.</p>
          {idleExpired && (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-400/20 rounded-lg px-3 py-2 mb-5">
              Your session expired due to inactivity. Please sign in again.
            </p>
          )}

          <label className="block text-sm text-slate-800 mb-1.5">Email</label>
          <input
            type="email"
            name="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            autoFocus
            className="w-full bg-white border border-[#e5eaf1] rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#1d4ed8] mb-4"
          />

          <label className="block text-sm text-slate-800 mb-1.5">Password</label>
          <PasswordInput
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            required
            className="w-full bg-white border border-[#e5eaf1] rounded-lg px-3 py-2.5 text-sm focus-within:border-[#1d4ed8] mb-7"
          />

          <button
            type="submit"
            disabled={busy || !email || !password}
            className="w-full bg-[#1d4ed8] hover:bg-[#1e40af] text-white text-[#ffffff] disabled:opacity-40 rounded-lg px-6 py-3 font-semibold text-sm transition-colors"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>

          <p className="flex justify-center mt-6">
            <BackLink href="/" className="text-slate-800 hover:text-slate-900">
              Back to site
            </BackLink>
          </p>
        </form>
      </div>
      {toast}
    </div>
  );
}
