"use client";

import { Share2 } from "lucide-react";

interface Props {
  lines: string[];
  /** When set, shared via the Web Share API with the image file attached
   *  (WhatsApp shows the image itself — event banner, ticket QR, etc. — not
   *  just a link preview). Falls back to the text+link wa.me share on
   *  desktop or if the fetch/share fails. Accepts a hosted URL or a `data:`
   *  URI (e.g. a QR code data URL) — both are fetchable as a Blob. */
  imageUrl?: string;
}

/** WhatsApp share button — appends the current page URL to the message. */
export default function WhatsAppShare({ lines, imageUrl }: Props) {
  const share = async () => {
    const text = [...lines, window.location.href].join("\n");

    if (imageUrl && navigator.share && navigator.canShare) {
      try {
        const res = await fetch(imageUrl);
        const blob = await res.blob();
        const ext = blob.type.split("/")[1] || "jpg";
        const file = new File([blob], `share.${ext}`, { type: blob.type || "image/jpeg" });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], text });
          return;
        }
      } catch {
        // Fetch/share failed (CORS, unsupported, user cancelled) — fall
        // through to the link-based share below.
      }
    }

    window.open(
      `https://wa.me/?text=${encodeURIComponent(text)}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  return (
    <button
      onClick={share}
      className="w-full inline-flex items-center justify-center gap-2 bg-[#1fb457] hover:bg-[#189a4a] text-white rounded-full px-5 py-3 font-semibold text-sm transition-colors"
    >
      <Share2 className="w-4 h-4" aria-hidden="true" />
      Share on WhatsApp
    </button>
  );
}
