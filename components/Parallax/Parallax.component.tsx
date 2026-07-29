"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  children: React.ReactNode;
  /** Fraction of scroll distance the layer lags behind by — small values
   *  (0.1–0.25) read as depth without feeling disorienting. */
  speed?: number;
  /** Clamp so the offset never creates a visible gap at the container's
   *  edges — pair with an oversized wrapper (e.g. `-inset-y-12`) on an
   *  `overflow-hidden` ancestor so the extra travel room stays clipped. */
  max?: number;
  className?: string;
}

/**
 * Lightweight scroll-parallax wrapper — offsets its children opposite to
 * scroll, at a fraction of the page's speed. Disabled outright on narrow
 * viewports (avoids mobile scroll jank and iOS quirks around transformed
 * fixed-ish layers) and for `prefers-reduced-motion` users, so this is
 * additive polish — it never changes layout and never fights the existing
 * `.hero-frame-active` Ken Burns animation (that lives on the image itself;
 * this transform sits one level up, on the wrapper).
 */
export default function Parallax({ children, speed = 0.15, max = 40, className = "" }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const desktopQuery = window.matchMedia("(min-width: 768px)");

    let raf = 0;
    let scrollBound = false;

    const update = () => {
      const el = ref.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      setOffset(Math.max(-max, Math.min(max, top * speed)));
    };
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };

    // Re-evaluate whenever either condition flips — e.g. a desktop window
    // resized narrower mid-session shouldn't stay stuck mid-transform, and a
    // user toggling their OS "reduce motion" setting should take effect
    // immediately rather than needing a reload.
    const sync = () => {
      const enabled = !reduceMotionQuery.matches && desktopQuery.matches;
      if (enabled && !scrollBound) {
        scrollBound = true;
        update();
        window.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("resize", onScroll);
      } else if (!enabled && scrollBound) {
        scrollBound = false;
        cancelAnimationFrame(raf);
        window.removeEventListener("scroll", onScroll);
        window.removeEventListener("resize", onScroll);
        setOffset(0);
      }
    };

    sync();
    reduceMotionQuery.addEventListener("change", sync);
    desktopQuery.addEventListener("change", sync);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      reduceMotionQuery.removeEventListener("change", sync);
      desktopQuery.removeEventListener("change", sync);
    };
  }, [speed, max]);

  return (
    <div
      ref={ref}
      className={className}
      style={{ transform: `translate3d(0, ${offset}px, 0)`, willChange: "transform" }}
    >
      {children}
    </div>
  );
}
