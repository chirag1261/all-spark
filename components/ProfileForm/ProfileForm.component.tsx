"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";

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
  "w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#f84464]";

export default function ProfileForm({ profile }: Props) {
  const router = useRouter();
  const { showToast, toast } = useToast();
  const [name, setName] = useState(profile.name);
  const [email, setEmail] = useState(profile.email ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const emailChanged = email.trim().toLowerCase() !== (profile.email ?? "");

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
        className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4"
      >
        <h2 className="font-semibold">Profile</h2>
        <div>
          <Label>Name</Label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            minLength={2}
            maxLength={80}
            className={inputCls}
          />
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
              <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide bg-emerald-500/15 text-emerald-400 px-1.5 py-0.5 rounded">
                Verified
              </span>
            )}
          </div>
          {emailChanged && (
            <p className="text-xs text-zinc-500 mt-1.5">
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
          disabled={busy || name.trim().length < 2}
          className="bg-[#f84464] hover:bg-[#e03a58] disabled:opacity-40 rounded-lg px-5 py-2.5 font-semibold text-sm transition-colors"
        >
          Save profile
        </button>
      </form>

      <form
        onSubmit={savePassword}
        className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4"
      >
        <h2 className="font-semibold">
          {profile.hasPassword ? "Change password" : "Set a password"}
        </h2>
        <p className="text-xs text-zinc-500">
          {profile.hasPassword
            ? "You can sign in with your password or a one-time code."
            : "Optional — you can always sign in with a one-time code instead."}
        </p>
        {profile.hasPassword && (
          <div>
            <Label>Current password</Label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              required
              className={inputCls}
            />
          </div>
        )}
        <div>
          <Label>New password (min 8 characters)</Label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={128}
            className={inputCls}
          />
        </div>
        <button
          type="submit"
          disabled={busy || newPassword.length < 8}
          className="bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 rounded-lg px-5 py-2.5 font-semibold text-sm transition-colors"
        >
          {profile.hasPassword ? "Change password" : "Set password"}
        </button>
      </form>
      {toast}
    </div>
  );
}

function ContactRow({ value, verified }: { value: string | null; verified: boolean }) {
  if (!value) return <p className="text-sm text-zinc-600 py-2.5">Not added</p>;
  return (
    <p className="text-sm py-2.5 flex items-center gap-2 wrap-break-word min-w-0">
      <span className="min-w-0 wrap-break-word">{value}</span>
      {verified && (
        <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide bg-emerald-500/15 text-emerald-400 px-1.5 py-0.5 rounded">
          Verified
        </span>
      )}
    </p>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs text-zinc-500 mb-1.5">{children}</label>;
}
