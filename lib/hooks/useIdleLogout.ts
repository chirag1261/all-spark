"use client";

import { useEffect, useRef } from "react";

const IDLE_MS = 60 * 60 * 1000; // 1 hour
const EVENTS = ["mousemove", "keydown", "pointerdown", "scroll", "touchstart"] as const;

/**
 * Calls `onIdle` after IDLE_MS of no user interaction.
 * The timer resets on any of the listed DOM events. The latest callback is
 * held in a ref so the listeners are only attached once (on mount).
 */
export function useIdleLogout(onIdle: () => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onIdleRef = useRef(onIdle);

  // Keep the ref pointing at the latest callback without re-running the
  // listener effect below (refs must be written in an effect, not in render).
  useEffect(() => {
    onIdleRef.current = onIdle;
  }, [onIdle]);

  useEffect(() => {
    const reset = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => onIdleRef.current(), IDLE_MS);
    };
    reset();
    for (const ev of EVENTS) window.addEventListener(ev, reset, { passive: true });
    return () => {
      if (timer.current) clearTimeout(timer.current);
      for (const ev of EVENTS) window.removeEventListener(ev, reset);
    };
  }, []);
}
