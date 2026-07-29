"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { refundEligibility } from "@/lib/domain/events";
import { inr } from "@/utils";

import { useConfirm } from "../ConfirmDialog";
import { useToast } from "../Toast";

export default function RefundButton({
  orderId,
  amount,
  eventStartsAt,
}: {
  orderId: string;
  /** Booking amount in paise — the eligible fraction is computed from this. */
  amount: number;
  /** The event's start time; missing only if the event record itself was deleted. */
  eventStartsAt?: string;
}) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const { confirm, dialog } = useConfirm();
  const { showToast, toast } = useToast();

  const eligibility = eventStartsAt
    ? refundEligibility(eventStartsAt)
    : { allowed: true, fraction: 0.7 as const };
  const refundAmount = Math.round(amount * eligibility.fraction);

  const refund = async () => {
    const ok = await confirm({
      title: "Refund booking",
      message:
        eligibility.fraction === 0.7
          ? `Refund ${inr(refundAmount)} (70% — 30% cancellation charge, more than 7 days before the event) and release the seats?`
          : `Refund ${inr(refundAmount)} (50% cancellation charge — 7 days to 48 hours before the event) and release the seats?`,
      confirmLabel: "Refund",
      tone: "danger",
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error ?? "Refund failed", "error");
        setBusy(false);
        return;
      }
      showToast(`${inr(data.amount ?? refundAmount)} refunded and seats released`);
      router.refresh();
    } catch {
      showToast("Could not reach the server", "error");
      setBusy(false);
    }
  };

  if (!eligibility.allowed) {
    return (
      <span
        className="text-slate-400 cursor-not-allowed"
        title="The event starts in less than 48 hours — refunds can no longer be requested."
      >
        Refund window closed
      </span>
    );
  }

  return (
    <span className="inline-flex flex-col items-end">
      <button
        onClick={refund}
        disabled={busy}
        className="text-red-700 hover:text-red-700 hover:underline disabled:opacity-40"
      >
        {busy ? "Refunding…" : eligibility.fraction === 0.7 ? "Refund (70%)" : "Refund (50%)"}
      </button>
      {dialog}
      {toast}
    </span>
  );
}
