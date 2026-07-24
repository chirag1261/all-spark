"use client";

import { useEffect, useState } from "react";

import { Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";

import { AdminRole, AdminUserPublic } from "@/types";

import { useConfirm } from "../ConfirmDialog";
import { useToast } from "../Toast";
import UserForm from "../UserForm";

interface Props {
  users: AdminUserPublic[];
  currentUserId: string;
}

const PERMISSION_LABELS: Record<string, string> = {
  events: "Events",
  bookings: "Bookings",
  promocodes: "Promo codes",
};

const ROLE_LABELS: Record<AdminRole, string> = {
  admin: "Admin",
  super_admin: "Super admin",
  gate_controller: "Gate staff",
};

/** Admin user table; create/edit happens in a slide-over drawer on the right. */
export default function AdminUsersPanel({ users, currentUserId }: Props) {
  const router = useRouter();
  const { confirm, dialog } = useConfirm();
  const { showToast, toast } = useToast();
  // null = closed, "new" = create, otherwise the user id being edited
  const [drawer, setDrawer] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const editing = drawer && drawer !== "new" ? users.find((u) => u.id === drawer) : undefined;

  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawer(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawer]);

  const toggleActive = async (u: AdminUserPublic) => {
    const deactivating = u.active;
    if (deactivating) {
      const ok = await confirm({
        title: "Deactivate admin",
        message: `Deactivate "${u.name}"? They'll be signed out and can't log back in until reactivated.`,
        confirmLabel: "Deactivate",
        tone: "danger",
      });
      if (!ok) return;
    }
    setBusyId(u.id);
    try {
      const res = await fetch(`/api/admin/users/${u.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !u.active }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error ?? "Could not update the account", "error");
        return;
      }
      router.refresh();
    } catch {
      showToast("Could not reach the server", "error");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <div className="flex items-center gap-4 mb-4">
        <h1 className="text-2xl font-bold">Admin users</h1>
        <button
          onClick={() => setDrawer("new")}
          className="ml-auto inline-flex items-center gap-1.5 bg-[#1d4ed8] hover:bg-[#1e40af] text-white rounded-lg px-4 py-2 font-semibold text-sm transition-colors"
        >
          <Plus className="w-4 h-4" aria-hidden="true" /> New admin
        </button>
      </div>
      <p className="text-sm text-slate-800 mb-6">
        Super admins can create, edit, deactivate and delete admin accounts, control which of
        Events and Bookings each admin can access, and create scanner-only gate staff. Refunds are
        restricted to super admins only.
      </p>

      <div className="overflow-x-auto border border-slate-200 rounded-xl">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-800 border-b border-slate-200 bg-slate-50">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Permissions</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Last login</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr
                key={u.id}
                className={`border-b border-slate-200 last:border-0 ${
                  u.active ? "" : "opacity-60"
                }`}
              >
                <td className="px-4 py-3">
                  <p className="font-medium">
                    {u.name}
                    {u.id === currentUserId && (
                      <span className="ml-2 text-[10px] font-bold uppercase tracking-wide bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                        You
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-slate-800">{u.email}</p>
                  {u.phone && <p className="text-sm text-slate-700">{u.phone}</p>}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block text-sm font-semibold px-2 py-0.5 rounded ${
                      u.role === "super_admin"
                        ? "bg-[#1d4ed8]/15 text-[#1d4ed8]"
                        : u.role === "gate_controller"
                          ? "bg-sky-50 text-sky-700"
                          : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {ROLE_LABELS[u.role]}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {u.role === "super_admin" ? (
                    <span className="text-slate-700">All</span>
                  ) : u.role === "gate_controller" ? (
                    <span className="text-slate-700">Scanner only</span>
                  ) : u.permissions.length === 0 ? (
                    <span className="text-slate-700">None</span>
                  ) : (
                    u.permissions.map((p) => PERMISSION_LABELS[p]).join(", ")
                  )}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block text-sm font-semibold px-2 py-0.5 rounded ${
                      u.active
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-red-50 text-red-700"
                    }`}
                  >
                    {u.active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600 whitespace-nowrap text-sm">
                  {u.lastLoginAt
                    ? new Date(u.lastLoginAt).toLocaleString("en-IN", {
                        timeZone: "Asia/Kolkata",
                        dateStyle: "medium",
                        timeStyle: "short",
                      })
                    : "Never"}
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <button
                    onClick={() => setDrawer(u.id)}
                    className="text-[#1d4ed8] hover:underline"
                  >
                    Edit
                  </button>
                  {u.id !== currentUserId && (
                    <button
                      onClick={() => toggleActive(u)}
                      disabled={busyId === u.id}
                      className={`ml-4 disabled:opacity-40 hover:underline ${
                        u.active ? "text-red-700" : "text-emerald-700"
                      }`}
                    >
                      {u.active ? "Deactivate" : "Activate"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Right slide-over drawer */}
      {drawer && (
        <div className="fixed inset-0 z-40" role="dialog" aria-modal="true">
          <button
            aria-label="Close editor"
            onClick={() => setDrawer(null)}
            className="absolute inset-0 bg-black/60 backdrop-blur-xs cursor-default"
          />
          <div className="absolute inset-y-0 right-0 w-full max-w-lg bg-white border-l border-slate-200 shadow-2xl flex flex-col animate-[slide-in_.2s_ease-out]">
            <div className="flex items-center gap-3 px-6 h-16 border-b border-slate-200 shrink-0">
              <h2 className="font-bold text-lg">{editing ? "Edit admin" : "New admin"}</h2>
              {editing && <span className="text-sm text-slate-800 truncate">{editing.email}</span>}
              <button
                onClick={() => setDrawer(null)}
                aria-label="Close"
                className="ml-auto w-8 h-8 inline-flex items-center justify-center rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
            <div className="overflow-y-auto p-6">
              <UserForm
                key={drawer}
                user={editing}
                currentUserId={currentUserId}
                onDone={() => setDrawer(null)}
              />
            </div>
          </div>
        </div>
      )}
      {dialog}
      {toast}
    </>
  );
}
