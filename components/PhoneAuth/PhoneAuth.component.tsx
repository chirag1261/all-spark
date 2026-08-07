"use client";

import { useState } from "react";

import { useToast } from "../Toast";

/**
 * OTP-only customer auth: mobile number → 6-digit SMS code → signed in (or,
 * for a new number, first/last name + optional email → account created).
 * No password anywhere. Shared between the standalone /login page and the
 * inline checkout-time auth step in BookingFlow — the caller decides what
 * happens next via `onSuccess`; this component only authenticates.
 *
 * Reuses the existing OTP infrastructure unchanged: /api/auth/start
 * classifies the number, /api/auth/otp/send + /api/auth/otp/verify issue and
 * check the code (same 5-minute-TTL, 5-attempt-lockout codes used
 * everywhere else), and /api/auth/signup creates the account once the phone
 * proof is presented.
 */

export interface AuthedCustomer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
}

type Step = "phone" | "otp" | "details";

const inputCls =
  "w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#1d4ed8]";
const otpInputCls = `${inputCls} text-center font-mono text-xl tracking-[0.5em]`;
const primaryBtn =
  "w-full bg-linear-to-r from-[#D4AF37] to-[#E6C35C] hover:brightness-105 text-[#081A3A] disabled:opacity-40 rounded-full px-6 py-2.5 font-semibold text-sm transition-all";

export default function PhoneAuth({
  onSuccess,
  intro,
}: {
  onSuccess: (customer: AuthedCustomer) => void;
  intro?: string;
}) {
  const { showToast, toast } = useToast();

  const [step, setStep] = useState<Step>("phone");
  const [rawPhone, setRawPhone] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [exists, setExists] = useState(false);
  const [code, setCode] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [phoneProof, setPhoneProof] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

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

  const submitPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = await api("/api/auth/start", { identifier: rawPhone });
    if (!data) return;
    if (data.channel !== "phone") {
      showToast("Enter a valid mobile number", "error");
      return;
    }
    const normalized = data.identifier as string;
    const accountExists = Boolean(data.exists);
    setIdentifier(normalized);
    setExists(accountExists);

    const sent = await api(
      "/api/auth/otp/send",
      accountExists ? { identifier: normalized } : { identifier: normalized, purpose: "signup" }
    );
    if (!sent) return;
    setNotice(`We sent a 6-digit code to ${normalized}.`);
    setCode("");
    setStep("otp");
  };

  const submitOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = await api("/api/auth/otp/verify", {
      identifier,
      code,
      purpose: exists ? "login" : "signup",
    });
    if (!data) {
      setCode("");
      return;
    }

    if (exists) {
      onSuccess(data.customer as AuthedCustomer);
      return;
    }
    // New number — verified, but no account/session yet. One more step.
    setPhoneProof(data.proof as string);
    setStep("details");
  };

  const submitDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (firstName.trim().length < 1) return showToast("Enter your first name", "error");
    const data = await api("/api/auth/signup", {
      name: `${firstName.trim()} ${lastName.trim()}`.trim(),
      phone: identifier,
      phoneProof,
      ...(email.trim() ? { email: email.trim() } : {}),
    });
    if (!data) return;
    onSuccess(data.customer as AuthedCustomer);
  };

  const resend = async () => {
    const sent = await api(
      "/api/auth/otp/send",
      exists ? { identifier } : { identifier, purpose: "signup" }
    );
    if (sent) {
      setCode("");
      showToast("New code sent", "success");
    }
  };

  return (
    <div>
      {step === "phone" && (
        <form onSubmit={submitPhone}>
          {intro && <p className="text-sm text-slate-500 mb-4">{intro}</p>}
          <input
            type="tel"
            value={rawPhone}
            onChange={(e) => setRawPhone(e.target.value)}
            placeholder="Mobile number"
            autoComplete="tel"
            required
            autoFocus
            className={inputCls}
          />
          <button
            type="submit"
            disabled={busy || !rawPhone.trim()}
            className={`${primaryBtn} mt-4`}
          >
            {busy ? "Checking…" : "Continue"}
          </button>
        </form>
      )}

      {step === "otp" && (
        <form onSubmit={submitOtp}>
          <p className="text-sm text-slate-500 mb-4">{notice}</p>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="6-digit code"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            pattern="\d{6}"
            autoFocus
            className={otpInputCls}
          />
          <button
            type="submit"
            disabled={busy || code.length !== 6}
            className={`${primaryBtn} mt-4`}
          >
            {busy ? "Verifying…" : "Verify"}
          </button>
          <button
            type="button"
            onClick={resend}
            disabled={busy}
            className="w-full mt-3 text-sm text-slate-600 hover:text-slate-800 disabled:opacity-40"
          >
            Resend code
          </button>
          <button
            type="button"
            onClick={() => setStep("phone")}
            className="w-full mt-2 text-xs text-slate-500 hover:text-slate-700"
          >
            Use a different number
          </button>
        </form>
      )}

      {step === "details" && (
        <form onSubmit={submitDetails} className="space-y-3">
          <p className="text-sm text-slate-500 mb-1">
            Verified! Just your name to finish creating your account.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="First name"
              autoComplete="given-name"
              required
              minLength={1}
              maxLength={80}
              autoFocus
              className={inputCls}
            />
            <input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Last name (optional)"
              autoComplete="family-name"
              maxLength={80}
              className={inputCls}
            />
          </div>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email address (optional)"
            autoComplete="email"
            className={inputCls}
          />
          <button type="submit" disabled={busy} className={primaryBtn}>
            {busy ? "Creating account…" : "Create account"}
          </button>
        </form>
      )}
      {toast}
    </div>
  );
}
