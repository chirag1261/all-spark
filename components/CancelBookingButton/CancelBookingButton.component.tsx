"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { useConfirm } from "../ConfirmDialog";
import { useToast } from "../Toast";

/** Admin action: cancel a PENDING booking and free its held seats. */
export default function CancelBookingButton({ orderId }: { orderId: string }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const { confirm, dialog } = useConfirm();
  const { showToast, toast } = useToast();

  const cancel = async () => {
    const ok = await confirm({
      title: "Cancel booking",
      message: "Cancel this pending booking and release its held seats?",
      confirmLabel: "Cancel booking",
      tone: "danger",
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error ?? "Cancel failed", "error");
        setBusy(false);
        return;
      }
      showToast("Booking cancelled and seats released");
      router.refresh();
    } catch {
      showToast("Could not reach the server", "error");
      setBusy(false);
    }
  };

  return (
    <span className="inline-flex flex-col items-end">
      <button
        onClick={cancel}
        disabled={busy}
        className="text-amber-700 hover:text-amber-700 hover:underline disabled:opacity-40"
      >
        {busy ? "Cancelling…" : "Cancel"}
      </button>
      {dialog}
      {toast}
    </span>
  );
}
