"use client";

import { useEffect, useState } from "react";

import { Plus, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { PromoCode } from "@/types";
import { inr } from "@/utils";

import { useConfirm } from "../ConfirmDialog";
import PromoCodeForm from "../PromoCodeForm";
import { useToast } from "../Toast";

interface EventOption {
  id: string;
  title: string;
}

interface Props {
  codes: PromoCode[];
  events: EventOption[];
}

function formatValue(p: PromoCode): string {
  return p.discountType === "percent"
    ? `${p.discountValue}%${p.maxDiscount != null ? ` (max ${inr(p.maxDiscount)})` : ""}`
    : inr(p.discountValue);
}

function formatDate(ms: number | null | undefined): string {
  if (ms == null) return "—";
  return new Date(ms).toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "2-digit",
  });
}

/** Promo-code table with a create/edit slide-over drawer. */
export default function AdminPromoCodesPanel({ codes, events }: Props) {
  const router = useRouter();
  const { confirm, dialog } = useConfirm();
  const { showToast, toast } = useToast();
  const [drawer, setDrawer] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const editing = drawer && drawer !== "new" ? codes.find((c) => c.id === drawer) : undefined;

  const eventTitle = (id?: string | null) =>
    id ? (events.find((e) => e.id === id)?.title ?? id) : "All events";

  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawer(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawer]);

  const toggleActive = async (c: PromoCode) => {
    if (c.active) {
      const ok = await confirm({
        title: "Deactivate promo code",
        message: `Deactivate "${c.code}"? Customers won't be able to apply it until reactivated.`,
        confirmLabel: "Deactivate",
        tone: "danger",
      });
      if (!ok) return;
    }
    setBusyId(c.id);
    try {
      const res = await fetch(`/api/admin/promocodes/${c.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !c.active }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error ?? "Could not update the code", "error");
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
        <h1 className="text-2xl font-bold">Promo codes</h1>
        <button
          onClick={() => setDrawer("new")}
          className="ml-auto inline-flex items-center gap-1.5 bg-[#1d4ed8] hover:bg-[#1e40af] text-white rounded-lg px-4 py-2 font-semibold text-sm transition-colors"
        >
          <Plus className="w-4 h-4" aria-hidden="true" /> New promo code
        </button>
      </div>
      <p className="text-sm text-slate-800 mb-6">
        Flat or percentage discounts, scoped to an event (or all events), with an optional total
        usage cap. A redemption is counted only when a payment is confirmed.
      </p>

      <div className="overflow-x-auto border border-slate-200 rounded-xl">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-white bg-[#1d4ed8]">
              <th className="px-4 py-3 font-medium">Code</th>
              <th className="px-4 py-3 font-medium">Discount</th>
              <th className="px-4 py-3 font-medium">Event</th>
              <th className="px-4 py-3 font-medium">Used / Limit</th>
              <th className="px-4 py-3 font-medium">Valid</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {codes.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-700">
                  No promo codes yet.
                </td>
              </tr>
            ) : (
              codes.map((c) => (
                <tr
                  key={c.id}
                  className={`border-b border-slate-200 last:border-0 ${c.active ? "" : "opacity-60"}`}
                >
                  <td className="px-4 py-3 font-mono font-semibold tracking-wide text-[#1d4ed8]">
                    {c.code}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-[10px] font-bold uppercase tracking-wide bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded mr-2">
                      {c.discountType === "percent" ? "%" : "Flat"}
                    </span>
                    {formatValue(c)}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{eventTitle(c.eventId)}</td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                    {c.redemptionCount} / {c.maxRedemptions ?? "∞"}
                  </td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap text-sm">
                    {formatDate(c.validFrom)} – {formatDate(c.validTo)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block text-sm font-semibold px-2 py-0.5 rounded ${
                        c.active
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-red-50 text-red-700"
                      }`}
                    >
                      {c.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button onClick={() => setDrawer(c.id)} className="text-[#1d4ed8] hover:underline">
                      Edit
                    </button>
                    <button
                      onClick={() => toggleActive(c)}
                      disabled={busyId === c.id}
                      className={`ml-4 disabled:opacity-40 hover:underline ${
                        c.active ? "text-red-700" : "text-emerald-700"
                      }`}
                    >
                      {c.active ? "Deactivate" : "Activate"}
                    </button>
                    <Link
                      href={`/admin/promocodes/new?cloneFrom=${c.id}`}
                      className="ml-4 text-slate-600 hover:text-slate-800 hover:underline"
                    >
                      Clone
                    </Link>
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
              <h2 className="font-bold text-lg">{editing ? "Edit promo code" : "New promo code"}</h2>
              {editing && (
                <span className="font-mono text-sm text-[#1d4ed8] truncate">{editing.code}</span>
              )}
              <button
                onClick={() => setDrawer(null)}
                aria-label="Close"
                className="ml-auto w-8 h-8 inline-flex items-center justify-center rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
            <div className="overflow-y-auto p-6">
              <PromoCodeForm
                key={drawer}
                promo={editing}
                events={events}
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
