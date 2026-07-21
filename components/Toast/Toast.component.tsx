"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Check, CircleAlert, X } from "lucide-react";
import { createPortal } from "react-dom";

type ToastTone = "success" | "error";

interface ToastState {
  open: boolean;
  message: string;
  tone: ToastTone;
}

const AUTO_DISMISS_MS = 3500;

/**
 * Lightweight toast, same pattern as useConfirm(): call showToast(...) from
 * an event handler, render {toast} once anywhere in the component's JSX.
 *
 *   const { showToast, toast } = useToast();
 *   showToast("Your profile has been updated");
 *   return <>...{toast}</>;
 */
export function useToast() {
  const [state, setState] = useState<ToastState>({ open: false, message: "", tone: "success" });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const close = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setState((s) => ({ ...s, open: false }));
  }, []);

  const showToast = useCallback(
    (message: string, tone: ToastTone = "success") => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setState({ open: true, message, tone });
      timerRef.current = setTimeout(close, AUTO_DISMISS_MS);
    },
    [close]
  );

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  // Portal to <body> — same reasoning as ConfirmDialog: a fixed-position
  // toast rendered under a backdrop-blur/filter/transform ancestor would
  // otherwise be pinned to that ancestor's box instead of the viewport.
  const toast =
    state.open && typeof document !== "undefined"
      ? createPortal(
          <ToastView message={state.message} tone={state.tone} onClose={close} />,
          document.body
        )
      : null;

  return { showToast, toast };
}

function ToastView({
  message,
  tone,
  onClose,
}: {
  message: string;
  tone: ToastTone;
  onClose: () => void;
}) {
  const success = tone === "success";
  return (
    <div
      className="fixed inset-x-0 bottom-6 z-50 flex justify-center px-4 pointer-events-none"
      role="status"
      aria-live="polite"
    >
      <div
        className={`pointer-events-auto flex items-center gap-3 max-w-sm rounded-2xl border px-4 py-3 shadow-[0_16px_40px_rgba(0,0,0,0.45)] backdrop-blur-md bg-[#16181d]/95 animate-[dialog-in_.18s_ease-out] ${
          success ? "border-emerald-500/30" : "border-red-500/30"
        }`}
      >
        <span
          className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
            success ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
          }`}
        >
          {success ? (
            <Check className="w-4 h-4" aria-hidden="true" />
          ) : (
            <CircleAlert className="w-4 h-4" aria-hidden="true" />
          )}
        </span>
        <p className="text-sm text-zinc-100 wrap-break-word min-w-0">{message}</p>
        <button
          onClick={onClose}
          aria-label="Dismiss"
          className="ml-1 shrink-0 text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
