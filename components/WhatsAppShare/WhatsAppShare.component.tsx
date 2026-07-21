"use client";

import { Share2 } from "lucide-react";

/** WhatsApp share button — appends the current page URL to the message. */
export default function WhatsAppShare({ lines }: { lines: string[] }) {
  const share = () => {
    const text = encodeURIComponent([...lines, window.location.href].join("\n"));
    window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer");
  };
  return (
    <button
      onClick={share}
      className="w-full inline-flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#1fb457] text-emerald-950 rounded-lg px-5 py-3 font-semibold text-sm transition-colors"
    >
      <Share2 className="w-4 h-4" aria-hidden="true" />
      Share on WhatsApp
    </button>
  );
}
