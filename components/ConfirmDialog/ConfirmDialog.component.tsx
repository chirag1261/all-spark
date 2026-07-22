"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { CircleHelp, TriangleAlert } from "lucide-react";
import { createPortal } from "react-dom";

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** "danger" red-tints the confirm button — use for destructive/irreversible actions. */
  tone?: "danger" | "default";
}

interface ConfirmState extends ConfirmOptions {
  open: boolean;
}

/**
 * Promise-based replacement for window.confirm(). Usage:
 *
 *   const { confirm, dialog } = useConfirm();
 *   const ok = await confirm({ message: "Delete this?", tone: "danger" });
 *   if (!ok) return;
 *   // ...render {dialog} once, anywhere in the component's JSX tree
 */
export function useConfirm() {
  const [state, setState] = useState<ConfirmState>({ open: false, message: "" });
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    setState({ ...options, open: true });
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = (result: boolean) => {
    setState((s) => ({ ...s, open: false }));
    resolver.current?.(result);
    resolver.current = null;
  };

  // Portal to <body> — a fixed-position dialog rendered as a descendant of
  // ANY ancestor with backdrop-blur/filter/transform (both SiteHeader and
  // AdminShell topbar uses backdrop-blur) gets pinned to that ancestor's box
  // instead of the viewport, per the CSS containing-block spec. Escaping
  // to <body> sidesteps that regardless of where useConfirm() is called from.
  const dialog =
    state.open && typeof document !== "undefined"
      ? createPortal(
          <ConfirmDialogView
            title={state.title}
            message={state.message}
            confirmLabel={state.confirmLabel}
            cancelLabel={state.cancelLabel}
            tone={state.tone}
            onConfirm={() => close(true)}
            onCancel={() => close(false)}
          />,
          document.body
        )
      : null;

  return { confirm, dialog };
}

function ConfirmDialogView({
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "default",
  onConfirm,
  onCancel,
}: {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "default";
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
      if (e.key === "Enter") onConfirm();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel, onConfirm]);

  const danger = tone === "danger";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="alertdialog"
      aria-modal="true"
    >
      <button
        aria-label="Cancel"
        onClick={onCancel}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm cursor-default animate-[fade-in_.15s_ease-out]"
      />
      <div className="relative w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl text-center animate-[dialog-in_.15s_ease-out]">
        <div
          className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 ${
            danger ? "bg-red-500/15 text-red-400" : "bg-[#d99a45]/15 text-[#d99a45]"
          }`}
        >
          {danger ? (
            <TriangleAlert className="w-7 h-7" aria-hidden="true" />
          ) : (
            <CircleHelp className="w-7 h-7" aria-hidden="true" />
          )}
        </div>
        {title && <h2 className="font-bold text-lg mb-1.5">{title}</h2>}
        <p className="text-sm text-zinc-400 leading-relaxed wrap-break-word">{message}</p>
        <div className="flex gap-3 mt-6">
          <button
            onClick={onCancel}
            autoFocus
            className="flex-1 text-sm font-medium text-zinc-300 border border-zinc-700 hover:bg-zinc-800 hover:border-zinc-600 px-4 py-2.5 rounded-lg transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 text-sm font-semibold px-4 py-2.5 rounded-lg shadow-lg transition-colors ${
              danger
                ? "bg-red-600 hover:bg-red-500 text-white shadow-red-600/20"
                : "bg-[#d99a45] hover:bg-[#bf863a] text-white shadow-[#d99a45]/20"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
