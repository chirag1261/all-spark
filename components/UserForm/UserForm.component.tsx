"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { ADMIN_PERMISSIONS, AdminPermission, AdminRole, AdminUserPublic } from "@/types";

import { useConfirm } from "../ConfirmDialog";
import { useToast } from "../Toast";

interface Props {
  user?: AdminUserPublic;
  /** The signed-in super admin editing this form — used to block self-deletion in the UI. */
  currentUserId: string;
  onDone: () => void;
}

const PERMISSION_LABELS: Partial<Record<AdminPermission, { label: string; hint: string }>> = {
  events: { label: "Events", hint: "Create, edit, publish and delete events" },
  bookings: { label: "Bookings", hint: "View bookings, export CSV, cancel pending ones" },
  promocodes: { label: "Promo codes", hint: "Create, edit and deactivate promo codes" },
};

const ROLE_LABELS: Record<AdminRole, string> = {
  admin: "Admin",
  super_admin: "Super admin",
  gate_controller: "Gate staff",
};

const inputCls =
  "w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#1d4ed8]";

export default function UserForm({ user, currentUserId, onDone }: Props) {
  const router = useRouter();
  const { confirm, dialog } = useConfirm();
  const { showToast, toast } = useToast();
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [password, setPassword] = useState("");
  // On edit the password field stays hidden until "Reset password" is clicked,
  // so routine edits never touch the credential. On create it's always shown.
  const [resetting, setResetting] = useState(!user);
  const [role, setRole] = useState<AdminRole>(user?.role ?? "admin");
  const [permissions, setPermissions] = useState<AdminPermission[]>(user?.permissions ?? []);
  const [busy, setBusy] = useState(false);

  const togglePermission = (p: AdminPermission) =>
    setPermissions((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) return showToast("Name is required", "error");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showToast("Enter a valid email", "error");
    if (!user && password.length < 8)
      return showToast("Password must be at least 8 characters", "error");
    if (password && password.length < 8)
      return showToast("Password must be at least 8 characters", "error");

    setBusy(true);
    const payload: Record<string, unknown> = { name, email, phone, role, permissions };
    if (password) payload.password = password;

    try {
      const res = await fetch(user ? `/api/admin/users/${user.id}` : "/api/admin/users", {
        method: user ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error ?? "Could not save the user", "error");
        setBusy(false);
        return;
      }
      router.refresh();
      onDone();
    } catch {
      showToast("Could not reach the server", "error");
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!user) return;
    const ok = await confirm({
      title: "Delete admin user",
      message: `Delete "${user.name}" (${user.email})? This cannot be undone.`,
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error ?? "Could not delete the user", "error");
        setBusy(false);
        return;
      }
      router.refresh();
      onDone();
    } catch {
      showToast("Could not reach the server", "error");
      setBusy(false);
    }
  };

  const isSelf = user?.id === currentUserId;

  return (
    <>
      <form onSubmit={submit} className="space-y-6">
        <div>
          <Label>Name</Label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className={inputCls}
          />
        </div>
        <div>
          <Label>Email</Label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className={inputCls}
          />
        </div>
        <div>
          <Label>Phone (optional)</Label>
          <input
            type="tel"
            value={phone ?? ""}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+91 98765 43210"
            className={inputCls}
          />
        </div>
        <div>
          <Label>{user ? "Password" : "Password"}</Label>
          {resetting ? (
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required={!user}
              autoComplete="new-password"
              placeholder={user ? "Set a new password (min 8 chars)" : ""}
              className={inputCls}
            />
          ) : (
            <button
              type="button"
              onClick={() => setResetting(true)}
              className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm text-slate-600 hover:text-slate-800 hover:border-slate-300 transition-colors"
            >
              Reset password
            </button>
          )}
          {user && resetting && (
            <p className="text-xs text-slate-400 mt-1.5">
              Share the new password with the user directly — they aren&apos;t emailed.
            </p>
          )}
        </div>

        <div>
          <Label>Role</Label>
          <div className="flex gap-2">
            {(["admin", "super_admin", "gate_controller"] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                disabled={isSelf && user?.role === "super_admin"}
                className={`flex-1 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                  role === r
                    ? "border-[#1d4ed8] bg-[#1d4ed8]/10 text-slate-900"
                    : "border-slate-200 text-slate-600 hover:text-slate-800"
                }`}
              >
                {ROLE_LABELS[r]}
              </button>
            ))}
          </div>
          {isSelf && user?.role === "super_admin" && (
            <p className="text-xs text-slate-400 mt-1.5">
              You can&apos;t change your own role — ask another super admin.
            </p>
          )}
        </div>

        {role === "admin" && (
          <div>
            <Label>Permissions</Label>
            <div className="space-y-2">
              {ADMIN_PERMISSIONS.map((p) => (
                <label
                  key={p}
                  className="flex items-start gap-3 bg-white border border-slate-200 rounded-xl p-3 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={permissions.includes(p)}
                    onChange={() => togglePermission(p)}
                    className="w-4 h-4 mt-0.5 accent-[#1d4ed8]"
                  />
                  <span className="text-sm">
                    <span className="font-medium">{PERMISSION_LABELS[p]?.label}</span>
                    <span className="block text-xs text-slate-500">{PERMISSION_LABELS[p]?.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}
        {role === "super_admin" && (
          <p className="text-xs text-slate-400">
            Super admins have every permission and can manage other admin users.
          </p>
        )}
        {role === "gate_controller" && (
          <p className="text-xs text-slate-400">
            Gate staff can only open the entry scanner to check in tickets — the rest of the
            admin is hidden from them.
          </p>
        )}

        <div className="flex items-center gap-4 pt-2">
          <button
            type="submit"
            disabled={busy}
            className="bg-[#1d4ed8] hover:bg-[#1e40af] text-white disabled:opacity-40 rounded-lg px-6 py-2.5 font-semibold text-sm transition-colors"
          >
            {busy ? "Saving…" : user ? "Save changes" : "Create user"}
          </button>
          <button
            type="button"
            onClick={onDone}
            className="text-sm text-slate-600 hover:text-slate-800"
          >
            Cancel
          </button>
          {user && !isSelf && (
            <button
              type="button"
              onClick={remove}
              disabled={busy}
              className="ml-auto text-sm text-red-700 hover:text-red-700 disabled:opacity-40"
            >
              Delete user
            </button>
          )}
        </div>
      </form>
      {dialog}
      {toast}
    </>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs text-slate-500 mb-1.5">{children}</label>;
}
