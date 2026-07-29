"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";

import PasswordInput from "../PasswordInput";
import { useToast } from "../Toast";

interface Props {
  profile: {
    name: string;
    email: string | null;
    phone: string | null;
    emailVerified: boolean;
    phoneVerified: boolean;
    hasPassword: boolean;
  };
}

const inputCls =
  "w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#1d4ed8]";
const passwordCls =
  "w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus-within:border-[#1d4ed8]";

/** Best-effort split of a stored full name into first/last for pre-filling
 *  the two inputs — the account still stores (and the API still expects) a
 *  single combined name string. */
function splitName(full: string) {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  return { first: parts[0] ?? "", last: parts.slice(1).join(" ") };
}

export default function ProfileForm({ profile }: Props) {
  const router = useRouter();
  const { showToast, toast } = useToast();
  const initialName = splitName(profile.name);
  const [firstName, setFirstName] = useState(initialName.first);
  const [lastName, setLastName] = useState(initialName.last);
  const [email, setEmail] = useState(profile.email ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const emailChanged = email.trim().toLowerCase() !== (profile.email ?? "");
  const name = lastName.trim() ? `${firstName.trim()} ${lastName.trim()}` : firstName.trim();

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/account", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast("Your profile has been updated");
        router.refresh();
      } else {
        showToast(data.error ?? "Could not update your profile", "error");
      }
    } catch {
      showToast("Could not reach the server", "error");
    } finally {
      setBusy(false);
    }
  };

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newPassword,
          ...(profile.hasPassword ? { currentPassword } : {}),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setCurrentPassword("");
        setNewPassword("");
        showToast("Your password has been updated");
        router.refresh();
      } else {
        showToast(data.error ?? "Could not update your password", "error");
      }
    } catch {
      showToast("Could not reach the server", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid md:grid-cols-2 gap-6 items-start">
      <form
        onSubmit={saveProfile}
        className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4"
      >
        <h2 className="font-semibold">Profile</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>First name</Label>
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              minLength={2}
              maxLength={80}
              className={inputCls}
            />
          </div>
          <div>
            <Label>Last name (optional)</Label>
            <input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              maxLength={80}
              className={inputCls}
            />
          </div>
        </div>
        <div>
          <Label>Email</Label>
          <div className="flex items-center gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={profile.phone ? "you@example.com (optional)" : "you@example.com"}
              className={inputCls}
            />
            {!emailChanged && profile.email && profile.emailVerified && (
              <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded">
                Verified
              </span>
            )}
          </div>
          {emailChanged && (
            <p className="text-xs text-slate-500 mt-1.5">
              You&apos;ll need to verify this with an OTP the next time you sign in with it.
            </p>
          )}
        </div>
        <div>
          <Label>Phone</Label>
          <ContactRow value={profile.phone} verified={profile.phoneVerified} />
        </div>
        <button
          type="submit"
          disabled={busy || firstName.trim().length < 2}
          className="bg-[#1d4ed8] hover:bg-[#1e40af] text-white disabled:opacity-40 rounded-lg px-5 py-2.5 font-semibold text-sm transition-colors"
        >
          Save profile
        </button>
      </form>

      <form
        onSubmit={savePassword}
        className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4"
      >
        <h2 className="font-semibold">
          {profile.hasPassword ? "Change password" : "Set a password"}
        </h2>
        <p className="text-xs text-slate-500">
          {profile.hasPassword
            ? "You can sign in with your password or a one-time code."
            : "Optional — you can always sign in with a one-time code instead."}
        </p>
        {profile.hasPassword && (
          <div>
            <Label>Current password</Label>
            <PasswordInput
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              required
              className={passwordCls}
            />
          </div>
        )}
        <div>
          <Label>New password (min 8 characters)</Label>
          <PasswordInput
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={128}
            className={passwordCls}
          />
        </div>
        <button
          type="submit"
          disabled={busy || newPassword.length < 8}
          className="bg-slate-100 hover:bg-slate-200 disabled:opacity-40 rounded-lg px-5 py-2.5 font-semibold text-sm transition-colors"
        >
          {profile.hasPassword ? "Change password" : "Set password"}
        </button>
      </form>
      {toast}
    </div>
  );
}

function ContactRow({ value, verified }: { value: string | null; verified: boolean }) {
  if (!value) return <p className="text-sm text-slate-400 py-2.5">Not added</p>;
  return (
    <p className="text-sm py-2.5 flex items-center gap-2 wrap-break-word min-w-0">
      <span className="min-w-0 wrap-break-word">{value}</span>
      {verified && (
        <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded">
          Verified
        </span>
      )}
    </p>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs text-slate-500 mb-1.5">{children}</label>;
}
