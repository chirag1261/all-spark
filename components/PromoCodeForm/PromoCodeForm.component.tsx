"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { PromoCode, PromoDiscountType } from "@/types";

import { useConfirm } from "../ConfirmDialog";
import { useToast } from "../Toast";

interface EventOption {
  id: string;
  title: string;
}

interface Props {
  promo?: PromoCode;
  /**
   * Prefills the form from an existing promo code without editing it — used
   * by the "Clone" action. Submitting still creates a brand-new code (POST),
   * never a PUT against the source. Ignored if `promo` is also set.
   */
  cloneFrom?: PromoCode;
  events: EventOption[];
  onDone: () => void;
}

const inputCls =
  "w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#1d4ed8]";

/** epoch ms → value for <input type="datetime-local"> in the admin's local tz. */
function toLocalInput(ms: number | null | undefined): string {
  if (ms == null) return "";
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Suggests an unused-looking code for a clone — final uniqueness is server-validated on save. */
function suggestCloneCode(code: string): string {
  const base = code.replace(/[^A-Z0-9]/g, "");
  const suffix = "COPY";
  return `${base.slice(0, 20 - suffix.length)}${suffix}`;
}

export default function PromoCodeForm({ promo, cloneFrom, events, onDone }: Props) {
  const router = useRouter();
  const { confirm, dialog } = useConfirm();
  const { showToast, toast } = useToast();
  const source = promo ?? cloneFrom;

  const [code, setCode] = useState(
    promo ? promo.code : cloneFrom ? suggestCloneCode(cloneFrom.code) : ""
  );
  const [discountType, setDiscountType] = useState<PromoDiscountType>(
    source?.discountType ?? "percent"
  );
  // For flat, discountValue is paise → show rupees; for percent it's the % itself.
  const [discountValue, setDiscountValue] = useState(
    source ? String(source.discountType === "flat" ? source.discountValue / 100 : source.discountValue) : ""
  );
  const [maxDiscount, setMaxDiscount] = useState(
    source?.maxDiscount != null ? String(source.maxDiscount / 100) : ""
  );
  const [minOrderAmount, setMinOrderAmount] = useState(
    source?.minOrderAmount ? String(source.minOrderAmount / 100) : ""
  );
  const [eventId, setEventId] = useState(source?.eventId ?? "");
  const [validFrom, setValidFrom] = useState(toLocalInput(source?.validFrom));
  const [validTo, setValidTo] = useState(toLocalInput(source?.validTo));
  const [maxRedemptions, setMaxRedemptions] = useState(
    source?.maxRedemptions != null ? String(source.maxRedemptions) : ""
  );
  // A clone never inherits "active" — it must be reviewed/renamed before it
  // can be redeemed by anyone.
  const [active, setActive] = useState(promo ? promo.active : !cloneFrom);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!/^[A-Za-z0-9]{3,20}$/.test(code.trim())) {
      return showToast("Code must be 3–20 letters/digits, no spaces", "error");
    }
    const val = Number(discountValue);
    if (!Number.isFinite(val) || val <= 0) {
      return showToast("Enter a positive discount value", "error");
    }
    if (discountType === "percent") {
      if (!Number.isInteger(val) || val > 100) {
        return showToast("Percentage must be a whole number 1–100", "error");
      }
      if (!Number(maxDiscount) || Number(maxDiscount) <= 0) {
        return showToast("A maximum discount cap (₹) is required for percentage codes", "error");
      }
    }
    if (validFrom && validTo && new Date(validFrom) >= new Date(validTo)) {
      return showToast('"Valid from" must be before "valid until"', "error");
    }

    setBusy(true);
    const payload = {
      code: code.trim().toUpperCase(),
      discountType,
      discountValue: val,
      maxDiscount: discountType === "percent" ? Number(maxDiscount) : undefined,
      minOrderAmount: minOrderAmount ? Number(minOrderAmount) : 0,
      eventId: eventId || null,
      validFrom: validFrom ? new Date(validFrom).toISOString() : null,
      validTo: validTo ? new Date(validTo).toISOString() : null,
      maxRedemptions: maxRedemptions ? Number(maxRedemptions) : null,
      active,
    };

    try {
      const res = await fetch(promo ? `/api/admin/promocodes/${promo.id}` : "/api/admin/promocodes", {
        method: promo ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error ?? "Could not save the promo code", "error");
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
    if (!promo) return;
    const ok = await confirm({
      title: "Delete promo code",
      message: `Delete "${promo.code}"? This cannot be undone.`,
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/promocodes/${promo.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error ?? "Could not delete the promo code", "error");
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

  return (
    <>
      <form onSubmit={submit} className="space-y-6">
        <div>
          <Label>Code</Label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="RUDRA20"
            required
            className={`${inputCls} font-mono tracking-wide uppercase`}
          />
        </div>

        <div>
          <Label>Discount type</Label>
          <div className="flex gap-2">
            {(["percent", "flat"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setDiscountType(t)}
                className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                  discountType === t
                    ? "border-[#1d4ed8] bg-[#1d4ed8]/10 text-slate-900"
                    : "border-slate-200 text-slate-600 hover:text-slate-800"
                }`}
              >
                {t === "percent" ? "Percentage" : "Flat amount"}
              </button>
            ))}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label>{discountType === "percent" ? "Discount (%)" : "Discount amount (₹)"}</Label>
            <input
              type="number"
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value)}
              placeholder={discountType === "percent" ? "e.g. 20" : "e.g. 250"}
              min={1}
              max={discountType === "percent" ? 100 : undefined}
              step={discountType === "percent" ? 1 : 0.01}
              required
              className={inputCls}
            />
          </div>
          {discountType === "percent" && (
            <div>
              <Label>Max discount cap (₹)</Label>
              <input
                type="number"
                value={maxDiscount}
                onChange={(e) => setMaxDiscount(e.target.value)}
                placeholder="e.g. 500"
                min={1}
                step={0.01}
                required
                className={inputCls}
              />
            </div>
          )}
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label>Minimum order (₹, optional)</Label>
            <input
              type="number"
              value={minOrderAmount}
              onChange={(e) => setMinOrderAmount(e.target.value)}
              placeholder="0"
              min={0}
              step={0.01}
              className={inputCls}
            />
          </div>
          <div>
            <Label>Applies to</Label>
            <select value={eventId} onChange={(e) => setEventId(e.target.value)} className={inputCls}>
              <option value="">All events</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label>Valid from (optional)</Label>
            <input
              type="datetime-local"
              value={validFrom}
              onChange={(e) => setValidFrom(e.target.value)}
              className={`${inputCls} dt-input`}
            />
          </div>
          <div>
            <Label>Valid until (optional)</Label>
            <input
              type="datetime-local"
              value={validTo}
              onChange={(e) => setValidTo(e.target.value)}
              className={`${inputCls} dt-input`}
            />
          </div>
        </div>

        <div>
          <Label>Total usage limit (optional)</Label>
          <input
            type="number"
            value={maxRedemptions}
            onChange={(e) => setMaxRedemptions(e.target.value)}
            placeholder="Unlimited"
            min={1}
            step={1}
            className={inputCls}
          />
          {promo && (
            <p className="text-xs text-slate-400 mt-1.5">
              Used so far: {promo.redemptionCount}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl p-4">
          <input
            id="promo-active"
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="w-4 h-4 accent-[#1d4ed8]"
          />
          <label htmlFor="promo-active" className="text-sm">
            <span className="font-medium">Active</span>
            <span className="text-slate-500"> — customers can apply this code at checkout</span>
          </label>
        </div>

        <div className="flex items-center gap-4 pt-1">
          <button
            type="submit"
            disabled={busy}
            className="bg-[#1d4ed8] hover:bg-[#1e40af] disabled:opacity-40 rounded-lg px-6 py-2.5 font-semibold text-sm transition-colors"
          >
            {busy ? "Saving…" : promo ? "Save changes" : "Create promo code"}
          </button>
          <button type="button" onClick={onDone} className="text-sm text-slate-600 hover:text-slate-800">
            Cancel
          </button>
          {promo && (
            <button
              type="button"
              onClick={remove}
              disabled={busy}
              className="ml-auto text-sm text-red-700 hover:text-red-700 disabled:opacity-40"
            >
              Delete
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
