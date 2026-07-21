import { Info } from "lucide-react";

/**
 * Small "(i)" info affordance with a hover/focus tooltip. Pure CSS (group-hover
 * + focus-within), so it works inside both server and client components without
 * shipping any JS. Used to make dashboard metrics and controls self-explanatory.
 */
export default function InfoTip({ text }: { text: string }) {
  return (
    <span className="relative inline-flex group align-middle">
      <span
        tabIndex={0}
        role="img"
        aria-label={text}
        className="text-zinc-500 flex items-center justify-center cursor-help hover:text-zinc-300 rounded-full focus:outline-none focus:ring-2 focus:ring-[#f84464]/40"
      >
        <Info className="w-4 h-4" aria-hidden="true" />
      </span>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-56 rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-xs font-normal normal-case tracking-normal text-zinc-200 text-left opacity-0 invisible group-hover:opacity-100 group-hover:visible group-focus-within:opacity-100 group-focus-within:visible transition-opacity duration-150 z-50 shadow-[0_12px_32px_rgba(0,0,0,0.5)]"
      >
        {text}
      </span>
    </span>
  );
}
