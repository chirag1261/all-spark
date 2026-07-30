"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  /** Plain text only — it's split on spaces to animate word-by-word. */
  children: string;
  className?: string;
  /** Stagger step between words, in ms. */
  stagger?: number;
  as?: "h1" | "h2" | "h3" | "p" | "span";
}

/**
 * Locomotive-scroll-style headline reveal: each word sits inside its own
 * `overflow-hidden` mask and rises up into place, staggered word-by-word, as
 * the heading scrolls into view — instead of the whole block fading in at
 * once (that's what <Reveal> already does). Same IntersectionObserver +
 * "reveal once, then stop observing" approach as <Reveal>, so it's just as
 * cheap, and `.reveal-word` is covered by the same `prefers-reduced-motion`
 * override in globals.css (shows immediately, no animation).
 */
export default function RevealText({
  children,
  className = "",
  stagger = 40,
  as = "span",
}: Props) {
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const words = children.split(" ");
  const Tag = as;

  return (
    // @ts-expect-error — union of intrinsic tags is fine at runtime
    <Tag ref={ref} className={className}>
      {words.flatMap((word, i) => [
        // A real space TEXT NODE between word-wrapper spans (not inside the
        // mask) — otherwise the browser has no break opportunity between two
        // adjacent inline-blocks and long headings stop wrapping on mobile.
        i > 0 ? " " : null,
        <span key={i} className="inline-block overflow-hidden align-top">
          <span
            className={`reveal-word ${shown ? "reveal-word-in" : ""}`}
            style={{ transitionDelay: `${i * stagger}ms` }}
          >
            {word}
          </span>
        </span>,
      ])}
    </Tag>
  );
}
