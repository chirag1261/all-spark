"use client";

import { useEffect, useState } from "react";

import { Plus, X } from "lucide-react";

import { AdminUserPublic } from "@/types";

import UserForm from "../UserForm";

interface Props {
  users: AdminUserPublic[];
  currentUserId: string;
}

const PERMISSION_LABELS: Record<string, string> = {
  events: "Events",
  bookings: "Bookings",
  refunds: "Refunds",
};

/** Admin user table; create/edit happens in a slide-over drawer on the right. */
export default function AdminUsersPanel({ users, currentUserId }: Props) {
  // null = closed, "new" = create, otherwise the user id being edited
  const [drawer, setDrawer] = useState<string | null>(null);
  const editing = drawer && drawer !== "new" ? users.find((u) => u.id === drawer) : undefined;

  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawer(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawer]);

  return (
    <>
      <div className="flex items-center gap-4 mb-4">
        <h1 className="text-2xl font-bold">Admin users</h1>
        <button
          onClick={() => setDrawer("new")}
          className="ml-auto inline-flex items-center gap-1.5 bg-[#d99a45] hover:bg-[#bf863a] rounded-lg px-4 py-2 font-semibold text-sm transition-colors"
        >
          <Plus className="w-4 h-4" aria-hidden="true" /> New admin
        </button>
      </div>
      <p className="text-sm text-zinc-500 mb-6">
        Super admins can create, edit and delete admin accounts, and control which of Events,
        Bookings and Refunds each admin can access.
      </p>

      <div className="overflow-x-auto border border-zinc-800 rounded-xl">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-zinc-500 border-b border-zinc-800 bg-zinc-900/60">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Permissions</th>
              <th className="px-4 py-3 font-medium">Last login</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-zinc-800/60 last:border-0">
                <td className="px-4 py-3">
                  <p className="font-medium">
                    {u.name}
                    {u.id === currentUserId && (
                      <span className="ml-2 text-[10px] font-bold uppercase tracking-wide bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded">
                        You
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-zinc-500">{u.email}</p>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block text-xs font-semibold px-2 py-0.5 rounded ${
                      u.role === "super_admin"
                        ? "bg-[#d99a45]/15 text-[#d99a45]"
                        : "bg-zinc-500/15 text-zinc-400"
                    }`}
                  >
                    {u.role === "super_admin" ? "Super admin" : "Admin"}
                  </span>
                </td>
                <td className="px-4 py-3 text-zinc-400">
                  {u.role === "super_admin" ? (
                    <span className="text-zinc-600">All</span>
                  ) : u.permissions.length === 0 ? (
                    <span className="text-zinc-600">None</span>
                  ) : (
                    u.permissions.map((p) => PERMISSION_LABELS[p]).join(", ")
                  )}
                </td>
                <td className="px-4 py-3 text-zinc-400 whitespace-nowrap text-xs">
                  {u.lastLoginAt
                    ? new Date(u.lastLoginAt).toLocaleString("en-IN", {
                        timeZone: "Asia/Kolkata",
                        dateStyle: "medium",
                        timeStyle: "short",
                      })
                    : "Never"}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => setDrawer(u.id)}
                    className="text-[#d99a45] hover:underline"
                  >
                    Edit
                  </button>
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
          <div className="absolute inset-y-0 right-0 w-full max-w-lg bg-zinc-950 border-l border-zinc-800 shadow-2xl flex flex-col animate-[slide-in_.2s_ease-out]">
            <div className="flex items-center gap-3 px-6 h-16 border-b border-zinc-800 shrink-0">
              <h2 className="font-bold text-lg">{editing ? "Edit admin" : "New admin"}</h2>
              {editing && <span className="text-xs text-zinc-500 truncate">{editing.email}</span>}
              <button
                onClick={() => setDrawer(null)}
                aria-label="Close"
                className="ml-auto w-8 h-8 inline-flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
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
    </>
  );
}
