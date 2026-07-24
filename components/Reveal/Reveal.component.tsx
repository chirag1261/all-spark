"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  children: React.ReactNode;
  /** Entrance direction/style — maps to the `.reveal-*` variant classes. */
  variant?: "up" | "left" | "right" | "scale";
  /** Stagger delay in ms, so sibling cards cascade in rather than pop together. */
  delay?: number;
  /** Element tag to render (default div). */
  as?: "div" | "section" | "li";
  className?: string;
}

const VARIANT_CLASS: Record<NonNullable<Props["variant"]>, string> = {
  up: "",
  left: "reveal-left",
  right: "reveal-right",
  scale: "reveal-scale",
};

/**
 * Scroll-triggered entrance wrapper. Renders children with `.reveal` (hidden,
 * offset) and flips to `.reveal-in` the first time it enters the viewport, then
 * stops observing. Children can be server components — they're passed straight
 * through. Reduced-motion users get the content immediately (handled in CSS).
 */
export default function Reveal({
  children,
  variant = "up",
  delay = 0,
  as = "div",
  className = "",
}: Props) {
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Already in view on mount (above the fold) → reveal right away.
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

  const cls = `reveal ${VARIANT_CLASS[variant]} ${shown ? "reveal-in" : ""} ${className}`.trim();
  const style = delay ? { transitionDelay: `${delay}ms` } : undefined;

  const Tag = as;
  return (
    // @ts-expect-error — union of intrinsic tags is fine at runtime
    <Tag ref={ref} className={cls} style={style}>
      {children}
    </Tag>
  );
}
