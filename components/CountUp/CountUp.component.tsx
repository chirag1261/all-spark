"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  /** Rendered as-is if it has no leading/trailing digits (e.g. "Rudrotsav") —
   *  otherwise the numeric part counts up from 0 once scrolled into view,
   *  keeping any non-digit prefix/suffix (e.g. "1500+", "₹1,500"). */
  value: string;
  durationMs?: number;
}

/** Scroll-triggered count-up for stat numbers. SSR/no-JS renders the final
 *  value directly; once mounted and in view it resets to 0 and animates up. */
export default function CountUp({ value, durationMs = 1400 }: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    const match = value.match(/^(\D*)(\d+)(\D*)$/);
    if (!match) return;
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const [, prefix, digits, suffix] = match;
    const target = parseInt(digits, 10);
    let raf = 0;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        const start = performance.now();
        const step = (now: number) => {
          const t = Math.min(1, (now - start) / durationMs);
          const eased = 1 - Math.pow(1 - t, 3);
          setDisplay(`${prefix}${Math.round(target * eased)}${suffix}`);
          if (t < 1) raf = requestAnimationFrame(step);
        };
        setDisplay(`${prefix}0${suffix}`);
        raf = requestAnimationFrame(step);
      },
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [value, durationMs]);

  return <span ref={ref}>{display}</span>;
}
