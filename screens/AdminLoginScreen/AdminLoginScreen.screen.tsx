"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";

import BackLink from "@/components/BackLink";
import { useToast } from "@/components/Toast";

export function AdminLoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const { showToast, toast } = useToast();
  const router = useRouter();

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
      router.push("/admin");
      router.refresh();
    } catch {
      showToast("Could not reach the server", "error");
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen text-zinc-100 flex items-center justify-center px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl p-8"
      >
        <h1 className="text-xl font-bold mb-1">Admin login</h1>
        <p className="text-sm text-zinc-500 mb-6">Sign in with your admin account.</p>
        <input
          type="email"
          name="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
          autoFocus
          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#d99a45] mb-3"
        />
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          required
          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#d99a45] mb-3"
        />
        <button
          type="submit"
          disabled={busy || !email || !password}
          className="w-full bg-[#d99a45] hover:bg-[#bf863a] disabled:opacity-40 rounded-lg px-6 py-2.5 font-semibold text-sm transition-colors"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
        <p className="flex justify-center mt-6">
          <BackLink href="/" className="text-zinc-500 hover:text-zinc-300">
            Back to site
          </BackLink>
        </p>
      </form>
      {toast}
    </div>
  );
}
