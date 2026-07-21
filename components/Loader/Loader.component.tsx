import { Loader2 } from "lucide-react";

interface Props {
  /** Message shown under the spinner. */
  label?: string;
  /** Render as a fixed full-screen overlay instead of an inline spinner. */
  fullscreen?: boolean;
}

/** Shared loading indicator — an inline spinner, or a full-screen overlay. */
export default function Loader({ label, fullscreen }: Props) {
  const spinner = (
    <div className="flex flex-col items-center gap-3">
      <Loader2 className="w-8 h-8 animate-spin text-[#f5a524]" aria-hidden="true" />
      {label && <p className="text-sm text-zinc-300">{label}</p>}
      <span className="sr-only">Loading</span>
    </div>
  );

  if (!fullscreen) return spinner;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0d0a1f]/90 backdrop-blur-sm animate-[fade-in_.15s_ease-out]"
    >
      {spinner}
    </div>
  );
}
