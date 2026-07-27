"use client";

import { useState } from "react";

import PasswordInput from "../PasswordInput";
import { useRouteLoader } from "../RouteLoader";
import { useToast } from "../Toast";

/**
 * Customer auth wizard with two modes:
 *
 *  SIGN IN (existing accounts): enter email or phone → password (if set, with a
 *  "use a one-time code" switch and a "Forgot password?" link) or OTP → signed
 *  in. Unknown identifiers are offered the Create-account flow instead (never
 *  auto-created). Forgot-password branch: verify the account's own OTP
 *  (purpose "reset") → set a new password (/api/auth/password/reset) → signed in.
 *
 *  CREATE ACCOUNT (new accounts): name + email + phone + password → verify the
 *  email OTP → verify the phone OTP → account created and signed in. Both
 *  contacts must be proven before the account is created (see the matching
 *  two-proof check in /api/auth/signup).
 */

type Mode = "signin" | "signup";
type SigninStep = "identifier" | "password" | "otp" | "reset-otp" | "reset-password";
type SignupStep = "details" | "verify-email" | "verify-phone";

const inputCls =
  "w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#1d4ed8]";
const passwordCls =
  "w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus-within:border-[#1d4ed8]";
const primaryBtn =
  "w-full bg-linear-to-r from-[#1d4ed8] to-[#3b82f6] hover:brightness-110 text-white disabled:opacity-40 rounded-xl px-6 py-2.5 font-semibold text-sm transition-all";
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

  // Forgot-password sub-flow (a branch of sign-in): verify the account's own
  // OTP → set a new password → signed in.
  const [resetCode, setResetCode] = useState("");
  const [resetProofToken, setResetProofToken] = useState("");
  const [newResetPassword, setNewResetPassword] = useState("");

  // Sign-up state
  const [signupStep, setSignupStep] = useState<SignupStep>("details");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [emailProof, setEmailProof] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [phoneCode, setPhoneCode] = useState("");

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
    setResetCode("");
    setResetProofToken("");
    setNewResetPassword("");
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

  // ---------------- Forgot password ----------------

  const startForgotPassword = async () => {
    const sent = await api("/api/auth/otp/send", { identifier });
    if (!sent) return;
    setNotice(`We sent a 6-digit code to ${identifier} to reset your password.`);
    setResetCode("");
    setSigninStep("reset-otp");
  };

  const submitResetOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const verified = await api("/api/auth/otp/verify", {
      identifier,
      code: resetCode,
      purpose: "reset",
    });
    if (!verified) return;
    setResetProofToken(verified.proof as string);
    setNewResetPassword("");
    setSigninStep("reset-password");
  };

  const submitNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newResetPassword.length < 8)
      return showToast("Password must be at least 8 characters", "error");
    const data = await api("/api/auth/password/reset", {
      identifier,
      proof: resetProofToken,
      newPassword: newResetPassword,
    });
    if (data) finish();
  };

  // ---------------- Create account ----------------

  const submitDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) return showToast("Enter your name", "error");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      return showToast("Enter a valid email address", "error");
    if (phone.replace(/[\s()-]/g, "").replace(/^\+/, "").length < 8)
      return showToast("Enter a valid phone number", "error");
    if (signupPassword.length < 8) return showToast("Password must be at least 8 characters", "error");

    const sent = await api("/api/auth/otp/send", { identifier: email.trim(), purpose: "signup" });
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
    setEmailProof(verified.proof as string);
    // Email proven — now prove the phone number before the account is created.
    const sent = await api("/api/auth/otp/send", { identifier: phone.trim(), purpose: "signup" });
    if (!sent) return;
    setPhoneCode("");
    setSignupStep("verify-phone");
  };

  const submitPhoneCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const verified = await api("/api/auth/otp/verify", {
      identifier: phone.trim(),
      code: phoneCode,
      purpose: "signup",
    });
    if (!verified) return;
    const data = await api("/api/auth/signup", {
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      password: signupPassword,
      emailProof,
      phoneProof: verified.proof as string,
    });
    if (data) finish();
  };

  const resend = (identifierValue: string, purpose?: "signup") => async () => {
    const sent = await api(
      "/api/auth/otp/send",
      purpose ? { identifier: identifierValue, purpose } : { identifier: identifierValue }
    );
    if (sent) showToast("New code sent", "success");
  };

  // ---------------- Render ----------------

  return (
    <div>
      {/* Mode toggle */}
      <div className="flex gap-1 mb-6 bg-slate-100 rounded-xl p-1">
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
          <PasswordInput
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoComplete="current-password"
            required
            autoFocus
            className={passwordCls}
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
          <button
            type="button"
            onClick={startForgotPassword}
            disabled={busy}
            className="w-full mt-2 text-sm text-slate-600 hover:text-slate-800 disabled:opacity-40"
          >
            Forgot password?
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

      {/* ---- Forgot password: verify OTP ---- */}
      {mode === "signin" && signinStep === "reset-otp" && (
        <form onSubmit={submitResetOtp}>
          <h2 className="font-semibold mb-1">Reset your password</h2>
          <p className="text-sm text-slate-500 mb-4">{notice}</p>
          <input
            value={resetCode}
            onChange={(e) => setResetCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
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
            disabled={busy || resetCode.length !== 6}
            className={`${primaryBtn} mt-4`}
          >
            {busy ? "Verifying…" : "Verify & continue"}
          </button>
          <button
            type="button"
            onClick={resend(identifier)}
            disabled={busy}
            className="w-full mt-3 text-sm text-slate-600 hover:text-slate-800 disabled:opacity-40"
          >
            Resend code
          </button>
          <BackLink onClick={() => setSigninStep("password")}>Back to sign in</BackLink>
        </form>
      )}

      {/* ---- Forgot password: set a new password ---- */}
      {mode === "signin" && signinStep === "reset-password" && (
        <form onSubmit={submitNewPassword}>
          <h2 className="font-semibold mb-1">Set a new password</h2>
          <p className="text-sm text-slate-500 mb-4">
            Verified! Choose a new password for{" "}
            <span className="text-slate-700">{identifier}</span>.
          </p>
          <PasswordInput
            value={newResetPassword}
            onChange={(e) => setNewResetPassword(e.target.value)}
            placeholder="New password (min 8 characters)"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={128}
            autoFocus
            className={passwordCls}
          />
          <button
            type="submit"
            disabled={busy || newResetPassword.length < 8}
            className={`${primaryBtn} mt-4`}
          >
            {busy ? "Saving…" : "Set password & sign in"}
          </button>
          <BackLink onClick={() => setSigninStep("identifier")}>Use a different account</BackLink>
        </form>
      )}

      {/* ---- Create account ---- */}
      {mode === "signup" && signupStep === "details" && (
        <form onSubmit={submitDetails} className="space-y-3">
          <p className="text-sm text-slate-500 mb-1">
            We&apos;ll verify your email and phone with one-time codes.
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
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone number"
            autoComplete="tel"
            required
            className={inputCls}
          />
          <PasswordInput
            value={signupPassword}
            onChange={(e) => setSignupPassword(e.target.value)}
            placeholder="Create a password (min 8 characters)"
            autoComplete="new-password"
            required
            minLength={8}
            className={passwordCls}
          />
          <button type="submit" disabled={busy} className={primaryBtn}>
            {busy ? "Sending code…" : "Continue"}
          </button>
        </form>
      )}

      {mode === "signup" && signupStep === "verify-email" && (
        <form onSubmit={submitEmailCode}>
          <h2 className="font-semibold mb-1">Step 1 of 2 · Verify your email</h2>
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
            {busy ? "Sending code…" : "Verify email"}
          </button>
          <button
            type="button"
            onClick={resend(email.trim(), "signup")}
            disabled={busy}
            className="w-full mt-3 text-sm text-slate-600 hover:text-slate-800 disabled:opacity-40"
          >
            Resend code
          </button>
          <BackLink onClick={() => setSignupStep("details")}>Edit my details</BackLink>
        </form>
      )}

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
            onClick={resend(phone.trim(), "signup")}
            disabled={busy}
            className="w-full mt-3 text-sm text-slate-600 hover:text-slate-800 disabled:opacity-40"
          >
            Resend code
          </button>
          <BackLink onClick={() => setSignupStep("details")}>Edit my details</BackLink>
        </form>
      )}
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