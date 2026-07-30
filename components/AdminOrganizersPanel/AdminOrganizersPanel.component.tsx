"use client";

import { useEffect, useState } from "react";

import { Plus, X } from "lucide-react";

import { Organizer } from "@/types";

import OrganizerForm from "../OrganizerForm";

interface Props {
  organizers: Organizer[];
  cloudinaryEnabled: boolean;
}

/** Organizer table with a create/edit slide-over drawer. */
export default function AdminOrganizersPanel({ organizers, cloudinaryEnabled }: Props) {
  const [drawer, setDrawer] = useState<string | null>(null);
  const editing =
    drawer && drawer !== "new" ? organizers.find((o) => o.id === drawer) : undefined;

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
        <h1 className="text-2xl font-bold">Organizers</h1>
        <button
          onClick={() => setDrawer("new")}
          className="ml-auto inline-flex items-center gap-1.5 bg-[#1d4ed8] hover:bg-[#1e40af] text-white rounded-lg px-4 py-2 font-semibold text-sm transition-colors"
        >
          <Plus className="w-4 h-4" aria-hidden="true" /> Add organizer
        </button>
      </div>
      <p className="text-sm text-slate-800 mb-6">
        Shown on the public Organizers page — photo, name and role for every team member. Unpublish
        instead of removing to hide someone without losing their details.
      </p>

      <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-white bg-[#1d4ed8]">
              <th className="px-4 py-3 font-medium">Organizer</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Order</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {organizers.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-700">
                  No organizers added yet.
                </td>
              </tr>
            ) : (
              organizers.map((o) => (
                <tr
                  key={o.id}
                  className={`border-b border-slate-200 last:border-0 ${o.published ? "" : "opacity-60"}`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {o.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={o.photoUrl}
                          alt=""
                          className="w-9 h-9 rounded-full object-cover border border-slate-200 shrink-0"
                        />
                      ) : (
                        <span className="w-9 h-9 rounded-full bg-slate-100 shrink-0" />
                      )}
                      <span className="font-medium">{o.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{o.role || "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{o.displayOrder}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block text-sm font-semibold px-2 py-0.5 rounded ${
                        o.published ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {o.published ? "Published" : "Hidden"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button onClick={() => setDrawer(o.id)} className="text-[#1d4ed8] hover:underline">
                      Edit
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {drawer && (
        <div className="fixed inset-0 z-40" role="dialog" aria-modal="true">
          <button
            aria-label="Close editor"
            onClick={() => setDrawer(null)}
            className="absolute inset-0 bg-black/60 backdrop-blur-xs cursor-default"
          />
          <div className="absolute inset-y-0 right-0 w-full max-w-lg bg-white border-l border-slate-200 shadow-2xl flex flex-col animate-[slide-in_.2s_ease-out]">
            <div className="flex items-center gap-3 px-6 h-16 border-b border-slate-200 shrink-0">
              <h2 className="font-bold text-lg">{editing ? "Edit organizer" : "Add organizer"}</h2>
              {editing && <span className="text-sm text-[#1d4ed8] truncate">{editing.name}</span>}
              <button
                onClick={() => setDrawer(null)}
                aria-label="Close"
                className="ml-auto w-8 h-8 inline-flex items-center justify-center rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
            <div className="overflow-y-auto p-6">
              <OrganizerForm
                key={drawer}
                organizer={editing}
                cloudinaryEnabled={cloudinaryEnabled}
                onDone={() => setDrawer(null)}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
