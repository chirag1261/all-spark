"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { useConfirm } from "../ConfirmDialog";
import { useToast } from "../Toast";

export default function RefundButton({
  orderId,
  amountInr,
}: {
  orderId: string;
  amountInr: string;
}) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const { confirm, dialog } = useConfirm();
  const { showToast, toast } = useToast();

  const refund = async () => {
    const ok = await confirm({
      title: "Refund booking",
      message: `Refund ${amountInr} and release the seats?`,
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
      showToast(`${amountInr} refunded and seats released`);
      router.refresh();
    } catch {
      showToast("Could not reach the server", "error");
      setBusy(false);
    }
  };

  return (
    <span className="inline-flex flex-col items-end">
      <button
        onClick={refund}
        disabled={busy}
        className="text-red-400 hover:text-red-300 hover:underline disabled:opacity-40"
      >
        {busy ? "Refunding…" : "Refund"}
      </button>
      {dialog}
      {toast}
    </span>
  );
}
