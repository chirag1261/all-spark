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
        className="text-slate-500 flex items-center justify-center cursor-help hover:text-slate-700 rounded-full focus:outline-none focus:ring-2 focus:ring-[#1d4ed8]/40"
      >
        <Info className="w-4 h-4" aria-hidden="true" />
      </span>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-56 rounded-lg bg-slate-100 border border-slate-300 px-3 py-2 text-xs font-normal normal-case tracking-normal text-slate-800 text-left opacity-0 invisible group-hover:opacity-100 group-hover:visible group-focus-within:opacity-100 group-focus-within:visible transition-opacity duration-150 z-50 shadow-[0_10px_24px_rgba(15,23,42,0.10)]"
      >
        {text}
      </span>
    </span>
  );
}
