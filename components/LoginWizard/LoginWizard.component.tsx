"use client";

import { useState } from "react";

import { useRouteLoader } from "../RouteLoader";
import { useToast } from "../Toast";

/**
 * Customer auth wizard with two modes:
 *
 *  SIGN IN (existing accounts): enter email or phone → password (if set, with a
 *  "use a one-time code" switch) or OTP → signed in. Unknown identifiers are
 *  offered the Create-account flow instead (never auto-created).
 *
 *  CREATE ACCOUNT (new accounts): name + email + password → verify the email
 *  OTP → account created and signed in.
 *
 *  NOTE: phone OTP verification is temporarily DISABLED here (and in
 *  /api/auth/signup) — our Twilio account is still in Trial mode (SMS only
 *  deliverable to manually-verified numbers), so requiring it would block
 *  every real signup. Re-enable by uncommenting the phone bits once Twilio
 *  has billing enabled.
 */

type Mode = "signin" | "signup";
type SigninStep = "identifier" | "password" | "otp";
type SignupStep = "details" | "verify-email"; // | "verify-phone" — disabled, see note above

const inputCls =
  "w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#1d4ed8]";
const primaryBtn =
  "w-full bg-linear-to-r from-[#1d4ed8] to-[#3b82f6] hover:brightness-110 disabled:opacity-40 rounded-xl px-6 py-2.5 font-semibold text-sm shadow-lg shadow-[#1d4ed8]/20 transition-all";
const otpInputCls = `${inputCls} text-center font-mono text-xl tracking-[0.5em]`;

export default function LoginWizard({ next }: { next: string }) {
  const routeLoader = useRouteLoader();
  const { showToast, toast } = useToast();

  const [mode, setMode] = useState<Mode>("signin");

  // Sign-in state
  const [signinStep, setSigninStep] = useState<SigninStep>("identifier");
  const [rawIdentifier, setRawIdentifier] = useState("");
  const [identifier, setIdentifier] = useState(""); // normalized, from the server
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  // Sign-up state
  const [signupStep, setSignupStep] = useState<SignupStep>("details");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  // const [phone, setPhone] = useState(""); — disabled, see note above
  const [signupPassword, setSignupPassword] = useState("");
  // const [emailProof, setEmailProof] = useState(""); — only needed once the
  // phone step returns (submitEmailCode currently uses the proof immediately)
  const [emailCode, setEmailCode] = useState("");
  // const [phoneCode, setPhoneCode] = useState("");

  const [busy, setBusy] = useState(false);

  const finish = () => routeLoader.navigate(next, "Signing you in…");

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

  const switchMode = (m: Mode) => {
    setMode(m);
    setSigninStep("identifier");
    setSignupStep("details");
    setPassword("");
    setCode("");
    setNotice(null);
  };

  // ---------------- Sign in ----------------

  const submitIdentifier = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = await api("/api/auth/start", { identifier: rawIdentifier });
    if (!data) return;
    const normalized = data.identifier as string;
    setIdentifier(normalized);

    if (!data.exists) {
      // No account — steer them into Create account, prefilling what they typed.
      // (Signup is email-only for now — see the disabled-phone note above.)
      if (data.channel === "email") setEmail(normalized);
      showToast("No account yet — let's create one.", "error");
      switchMode("signup");
      return;
    }
    if (data.hasPassword) {
      setSigninStep("password");
    } else {
      const sent = await api("/api/auth/otp/send", { identifier: normalized });
      if (!sent) return;
      setNotice(`We sent a 6-digit code to ${normalized}.`);
      setCode("");
      setSigninStep("otp");
    }
  };

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = await api("/api/auth/login", { identifier, password });
    if (data) finish();
  };

  const switchToOtp = async () => {
    const sent = await api("/api/auth/otp/send", { identifier });
    if (!sent) return;
    setNotice(`We sent a 6-digit code to ${identifier}.`);
    setCode("");
    setSigninStep("otp");
  };

  const submitSigninOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = await api("/api/auth/otp/verify", { identifier, code, purpose: "login" });
    if (data) finish();
  };

  // ---------------- Create account ----------------

  const submitDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) return showToast("Enter your name", "error");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      return showToast("Enter a valid email address", "error");
    // Phone collection/verification disabled for now — see note above.
    // if (phone.replace(/[\s()-]/g, "").replace(/^\+/, "").length < 8)
    //   return showToast("Enter a valid phone number", "error");
    if (signupPassword.length < 8) return showToast("Password must be at least 8 characters", "error");

    const sent = await api("/api/auth/otp/send", { identifier: email.trim() });
    if (!sent) return;
    setEmailCode("");
    setSignupStep("verify-email");
  };

  const submitEmailCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const verified = await api("/api/auth/otp/verify", {
      identifier: email.trim(),
      code: emailCode,
      purpose: "signup",
    });
    if (!verified) return;
    // Phone verification step disabled for now — sign up directly on email proof.
    // const sent = await api("/api/auth/otp/send", { identifier: phone.trim() });
    // if (!sent) return;
    // setPhoneCode("");
    // setSignupStep("verify-phone");
    const data = await api("/api/auth/signup", {
      name: name.trim(),
      email: email.trim(),
      password: signupPassword,
      emailProof: verified.proof as string,
    });
    if (data) finish();
  };

  // Disabled for now — Twilio is Trial-only (see note above). Uncomment and
  // wire back into submitEmailCode's flow once phone OTP verification returns.
  // const submitPhoneCode = async (e: React.FormEvent) => {
  //   e.preventDefault();
  //   const verified = await api("/api/auth/otp/verify", {
  //     identifier: phone.trim(),
  //     code: phoneCode,
  //     purpose: "signup",
  //   });
  //   if (!verified) return;
  //   const data = await api("/api/auth/signup", {
  //     name: name.trim(),
  //     email: email.trim(),
  //     phone: phone.trim(),
  //     password: signupPassword,
  //     emailProof,
  //     phoneProof: verified.proof as string,
  //   });
  //   if (data) finish();
  // };

  const resend = (identifierValue: string) => async () => {
    const sent = await api("/api/auth/otp/send", { identifier: identifierValue });
    if (sent) showToast("New code sent", "success");
  };

  // ---------------- Render ----------------

  return (
    <div className="bg-white border border-[#e5eaf1] rounded-3xl p-8 shadow-[0_16px_40px_rgba(15,23,42,0.10)]">
      {/* Mode toggle */}
      <div className="flex gap-1 mb-6 bg-white/90 border border-slate-200 rounded-xl p-1">
        {(["signin", "signup"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => switchMode(m)}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
              mode === m ? "bg-[#1d4ed8] text-white" : "text-slate-600 hover:text-slate-800"
            }`}
          >
            {m === "signin" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>

      {/* ---- Sign in ---- */}
      {mode === "signin" && signinStep === "identifier" && (
        <form onSubmit={submitIdentifier}>
          <p className="text-sm text-slate-500 mb-4">
            Enter your email or phone number to sign in.
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
          <button type="submit" disabled={busy || !rawIdentifier.trim()} className={`${primaryBtn} mt-4`}>
            {busy ? "Checking…" : "Continue"}
          </button>
        </form>
      )}

      {mode === "signin" && signinStep === "password" && (
        <form onSubmit={submitPassword}>
          <p className="text-sm text-slate-500 mb-4">
            Signing in as <span className="text-slate-700">{identifier}</span>
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
            className="w-full mt-3 text-sm text-[#1d4ed8] hover:underline disabled:opacity-40"
          >
            Sign in with a one-time code instead
          </button>
          <BackLink onClick={() => setSigninStep("identifier")}>Use a different account</BackLink>
        </form>
      )}

      {mode === "signin" && signinStep === "otp" && (
        <form onSubmit={submitSigninOtp}>
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
          <button type="submit" disabled={busy || code.length !== 6} className={`${primaryBtn} mt-4`}>
            {busy ? "Verifying…" : "Verify & sign in"}
          </button>
          <button
            type="button"
            onClick={resend(identifier)}
            disabled={busy}
            className="w-full mt-3 text-sm text-slate-600 hover:text-slate-800 disabled:opacity-40"
          >
            Resend code
          </button>
          <BackLink onClick={() => setSigninStep("identifier")}>Use a different account</BackLink>
        </form>
      )}

      {/* ---- Create account ---- */}
      {mode === "signup" && signupStep === "details" && (
        <form onSubmit={submitDetails} className="space-y-3">
          <p className="text-sm text-slate-500 mb-1">
            We&apos;ll verify your email with a one-time code.
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
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email address"
            autoComplete="email"
            required
            className={inputCls}
          />
          {/* Phone field disabled for now — see note at top of file. */}
          <input
            type="password"
            value={signupPassword}
            onChange={(e) => setSignupPassword(e.target.value)}
            placeholder="Create a password (min 8 characters)"
            autoComplete="new-password"
            required
            minLength={8}
            className={inputCls}
          />
          <button type="submit" disabled={busy} className={primaryBtn}>
            {busy ? "Sending code…" : "Continue"}
          </button>
        </form>
      )}

      {mode === "signup" && signupStep === "verify-email" && (
        <form onSubmit={submitEmailCode}>
          <h2 className="font-semibold mb-1">Verify your email</h2>
          <p className="text-sm text-slate-500 mb-4">
            Enter the 6-digit code we sent to <span className="text-slate-700">{email}</span>.
          </p>
          <input
            value={emailCode}
            onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
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
            disabled={busy || emailCode.length !== 6}
            className={`${primaryBtn} mt-4`}
          >
            {busy ? "Creating account…" : "Verify & create account"}
          </button>
          <button
            type="button"
            onClick={resend(email.trim())}
            disabled={busy}
            className="w-full mt-3 text-sm text-slate-600 hover:text-slate-800 disabled:opacity-40"
          >
            Resend code
          </button>
          <BackLink onClick={() => setSignupStep("details")}>Edit my details</BackLink>
        </form>
      )}

      {/* Phone verification step disabled for now — see note at top of file.
      {mode === "signup" && signupStep === "verify-phone" && (
        <form onSubmit={submitPhoneCode}>
          <h2 className="font-semibold mb-1">Step 2 of 2 · Verify phone</h2>
          <p className="text-sm text-slate-500 mb-4">
            Email verified! Now enter the code we sent to{" "}
            <span className="text-slate-700">{phone}</span>.
          </p>
          <input
            value={phoneCode}
            onChange={(e) => setPhoneCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
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
            disabled={busy || phoneCode.length !== 6}
            className={`${primaryBtn} mt-4`}
          >
            {busy ? "Creating account…" : "Verify & create account"}
          </button>
          <button
            type="button"
            onClick={resend(phone.trim())}
            disabled={busy}
            className="w-full mt-3 text-sm text-slate-600 hover:text-slate-800 disabled:opacity-40"
          >
            Resend code
          </button>
          <BackLink onClick={() => setSignupStep("details")}>Edit my details</BackLink>
        </form>
      )} */}
      {toast}
    </div>
  );
}

function BackLink({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full mt-4 text-xs text-slate-500 hover:text-slate-700"
    >
      {children}
    </button>
  );
}
