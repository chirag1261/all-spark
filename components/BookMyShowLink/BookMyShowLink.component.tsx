import { ExternalLink } from "lucide-react";

import { BOOKMYSHOW_LOGO_URL } from "@/constants";

/**
 * "Also on BookMyShow" callout — rendered only when the event has an
 * admin-set BookMyShow listing URL. Links out to that listing in a new tab.
 */
export default function BookMyShowLink({ url }: { url: string }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#2a2450] bg-[#171228] px-5 py-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={BOOKMYSHOW_LOGO_URL}
        alt="BookMyShow"
        className="h-6 w-auto bg-white rounded px-1.5 py-1"
      />
      <span className="text-sm text-zinc-300 min-w-0">
        Some seats for this event are also available on BookMyShow.
      </span>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="ml-auto inline-flex items-center gap-1.5 bg-[#c4242c] hover:bg-[#a91f26] text-white rounded-lg px-4 py-2 font-semibold text-sm transition-colors"
      >
        Book on BookMyShow
        <ExternalLink className="w-4 h-4" aria-hidden="true" />
      </a>
    </div>
  );
}
