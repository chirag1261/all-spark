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

const PERMISSION_LABELS: Record<AdminPermission, { label: string; hint: string }> = {
  events: { label: "Events", hint: "Create, edit, publish and delete events" },
  bookings: { label: "Bookings", hint: "View bookings, export CSV, cancel pending ones" },
  refunds: { label: "Refunds", hint: "Issue refunds for confirmed bookings" },
};

const inputCls =
  "w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#d99a45]";

export default function UserForm({ user, currentUserId, onDone }: Props) {
  const router = useRouter();
  const { confirm, dialog } = useConfirm();
  const { showToast, toast } = useToast();
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [password, setPassword] = useState("");
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
    const payload: Record<string, unknown> = { name, email, role, permissions };
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
          <Label>{user ? "New password (leave blank to keep current)" : "Password"}</Label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required={!user}
            autoComplete="new-password"
            className={inputCls}
          />
        </div>

        <div>
          <Label>Role</Label>
          <div className="flex gap-3">
            {(["admin", "super_admin"] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                disabled={isSelf && user?.role === "super_admin"}
                className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                  role === r
                    ? "border-[#d99a45] bg-[#d99a45]/10 text-zinc-100"
                    : "border-zinc-800 text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {r === "super_admin" ? "Super admin" : "Admin"}
              </button>
            ))}
          </div>
          {isSelf && user?.role === "super_admin" && (
            <p className="text-xs text-zinc-600 mt-1.5">
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
                  className="flex items-start gap-3 bg-zinc-900 border border-zinc-800 rounded-xl p-3 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={permissions.includes(p)}
                    onChange={() => togglePermission(p)}
                    className="w-4 h-4 mt-0.5 accent-[#d99a45]"
                  />
                  <span className="text-sm">
                    <span className="font-medium">{PERMISSION_LABELS[p].label}</span>
                    <span className="block text-xs text-zinc-500">{PERMISSION_LABELS[p].hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}
        {role === "super_admin" && (
          <p className="text-xs text-zinc-600">
            Super admins have every permission and can manage other admin users.
          </p>
        )}

        <div className="flex items-center gap-4 pt-2">
          <button
            type="submit"
            disabled={busy}
            className="bg-[#d99a45] hover:bg-[#bf863a] disabled:opacity-40 rounded-lg px-6 py-2.5 font-semibold text-sm transition-colors"
          >
            {busy ? "Saving…" : user ? "Save changes" : "Create user"}
          </button>
          <button
            type="button"
            onClick={onDone}
            className="text-sm text-zinc-400 hover:text-zinc-200"
          >
            Cancel
          </button>
          {user && !isSelf && (
            <button
              type="button"
              onClick={remove}
              disabled={busy}
              className="ml-auto text-sm text-red-400 hover:text-red-300 disabled:opacity-40"
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
  return <label className="block text-xs text-zinc-500 mb-1.5">{children}</label>;
}
