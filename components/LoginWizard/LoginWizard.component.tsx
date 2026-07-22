"use client";

import { useState } from "react";

import { useRouteLoader } from "../RouteLoader";
import { useToast } from "../Toast";

/**
 * Email/phone-first login + signup wizard:
 *  1. Enter email or phone.
 *  2. New user → signup (name) → OTP to that contact.
 *     Existing user with a password → password (or switch to OTP).
 *     Existing user without a password → OTP.
 *  3. Verify OTP → signed in, redirected back to where they came from.
 */

type Step = "identifier" | "signup" | "password" | "otp";

const inputCls =
  "w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#d99a45]";
const primaryBtn =
  "w-full bg-linear-to-r from-[#d99a45] to-[#e8bd6b] hover:brightness-110 disabled:opacity-40 rounded-xl px-6 py-2.5 font-semibold text-sm shadow-lg shadow-[#d99a45]/20 transition-all";

export default function LoginWizard({ next }: { next: string }) {
  const routeLoader = useRouteLoader();
  const { showToast, toast } = useToast();
  const [step, setStep] = useState<Step>("identifier");
  const [rawIdentifier, setRawIdentifier] = useState("");
  const [identifier, setIdentifier] = useState(""); // normalized, from the server
  const [channel, setChannel] = useState<"email" | "phone">("email");
  const [isNew, setIsNew] = useState(false);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const finish = () => {
    // Buffer loader stays up through the redirect + destination render.
    routeLoader.navigate(next, "Signing you in…");
  };

  const api = async (url: string, body: unknown): Promise<Record<string, unknown> | null> => {
    setBusy(true);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast((data.error as string) ?? "Something went wrong", "error");
        return null;
      }
      return data;
    } catch {
      showToast("Could not reach the server", "error");
      return null;
    } finally {
      setBusy(false);
    }
  };

  const sendOtp = async (): Promise<boolean> => {
    const data = await api("/api/auth/otp/send", { identifier });
    if (!data) return false;
    setNotice(
      channel === "email"
        ? `We emailed a 6-digit code to ${identifier}.`
        : `We texted a 6-digit code to ${identifier}.`
    );
    setCode("");
    return true;
  };

  const submitIdentifier = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = await api("/api/auth/start", { identifier: rawIdentifier });
    if (!data) return;
    const normalized = data.identifier as string;
    setIdentifier(normalized);
    setChannel(data.channel as "email" | "phone");
    if (!data.exists) {
      setIsNew(true);
      setStep("signup");
    } else if (data.hasPassword) {
      setIsNew(false);
      setStep("password");
    } else {
      setIsNew(false);
      // OTP-only account — fire the code immediately.
      const ok = await apiSendOtpFor(normalized);
      if (ok) setStep("otp");
    }
  };

  // sendOtp against an explicit identifier (state may not have flushed yet).
  const apiSendOtpFor = async (id: string): Promise<boolean> => {
    const data = await api("/api/auth/otp/send", { identifier: id });
    if (!data) return false;
    setNotice(`We sent a 6-digit code to ${id}.`);
    setCode("");
    return true;
  };

  const submitSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) return showToast("Enter your name", "error");
    if (await sendOtp()) setStep("otp");
  };

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = await api("/api/auth/login", { identifier, password });
    if (data) finish();
  };

  const switchToOtp = async () => {
    if (await sendOtp()) setStep("otp");
  };

  const submitOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = await api("/api/auth/otp/verify", {
      identifier,
      code,
      ...(isNew ? { name } : {}),
    });
    if (data) finish();
  };

  return (
    <div className="bg-[#171228] border border-[#2a2450] rounded-3xl p-8 shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
      {step === "identifier" && (
        <form onSubmit={submitIdentifier}>
          <h1 className="text-xl font-bold mb-1">Sign in or create an account</h1>
          <p className="text-sm text-zinc-500 mb-6">
            Use your email or phone number — we&apos;ll figure out the rest.
          </p>
          <input
            value={rawIdentifier}
            onChange={(e) => setRawIdentifier(e.target.value)}
            placeholder="you@example.com or 98765 43210"
            autoComplete="username"
            required
            autoFocus
            className={inputCls}
          />
          <button
            type="submit"
            disabled={busy || !rawIdentifier.trim()}
            className={`${primaryBtn} mt-4`}
          >
            {busy ? "Checking…" : "Continue"}
          </button>
        </form>
      )}

      {step === "signup" && (
        <form onSubmit={submitSignup}>
          <h1 className="text-xl font-bold mb-1">Create your account</h1>
          <p className="text-sm text-zinc-500 mb-6">
            New here! We&apos;ll verify <span className="text-zinc-300">{identifier}</span> with a
            one-time code.
          </p>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your full name"
            autoComplete="name"
            required
            minLength={2}
            maxLength={80}
            autoFocus
            className={inputCls}
          />
          <button
            type="submit"
            disabled={busy || name.trim().length < 2}
            className={`${primaryBtn} mt-4`}
          >
            {busy ? "Sending code…" : `Send code to my ${channel}`}
          </button>
          <BackToStart onClick={() => setStep("identifier")} />
        </form>
      )}

      {step === "password" && (
        <form onSubmit={submitPassword}>
          <h1 className="text-xl font-bold mb-1">Welcome back</h1>
          <p className="text-sm text-zinc-500 mb-6">
            Signing in as <span className="text-zinc-300">{identifier}</span>
          </p>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoComplete="current-password"
            required
            autoFocus
            className={inputCls}
          />
          <button type="submit" disabled={busy || !password} className={`${primaryBtn} mt-4`}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
          <button
            type="button"
            onClick={switchToOtp}
            disabled={busy}
            className="w-full mt-3 text-sm text-[#d99a45] hover:underline disabled:opacity-40"
          >
            Sign in with a one-time code instead
          </button>
          <BackToStart onClick={() => setStep("identifier")} />
        </form>
      )}

      {step === "otp" && (
        <form onSubmit={submitOtp}>
          <h1 className="text-xl font-bold mb-1">
            {isNew ? "Verify your account" : "Welcome back"}
          </h1>
          <p className="text-sm text-zinc-500 mb-6">{notice}</p>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="6-digit code"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            pattern="\d{6}"
            autoFocus
            className={`${inputCls} text-center font-mono text-xl tracking-[0.5em]`}
          />
          <button
            type="submit"
            disabled={busy || code.length !== 6}
            className={`${primaryBtn} mt-4`}
          >
            {busy ? "Verifying…" : isNew ? "Verify & create account" : "Verify & sign in"}
          </button>
          <button
            type="button"
            onClick={sendOtp}
            disabled={busy}
            className="w-full mt-3 text-sm text-zinc-400 hover:text-zinc-200 disabled:opacity-40"
          >
            Resend code
          </button>
          <BackToStart onClick={() => setStep("identifier")} />
        </form>
      )}
      {toast}
    </div>
  );
}

function BackToStart({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full mt-4 text-xs text-zinc-500 hover:text-zinc-300"
    >
      Use a different email or phone
    </button>
  );
}
