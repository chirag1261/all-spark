"use client";

import { useEffect, useState } from "react";

// Brand gold plus the SeatMap tier palette, so the burst reads as "this app"
// rather than generic rainbow confetti.
const COLORS = ["#d99a45", "#e8bd6b", "#34d399", "#38bdf8", "#a78bfa", "#fb7185"];
const PIECE_COUNT = 60;
const DURATION_MS = 3200;

interface Particle {
  id: number;
  left: number;
  delay: number;
  duration: number;
  spin: number;
  color: string;
  size: number;
  round: boolean;
}

function makeParticles(): Particle[] {
  return Array.from({ length: PIECE_COUNT }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 0.5,
    duration: 2.4 + Math.random() * 1.2,
    spin: (Math.random() > 0.5 ? 1 : -1) * (360 * (2 + Math.random() * 2)),
    color: COLORS[i % COLORS.length],
    size: 6 + Math.random() * 5,
    round: i % 3 === 0,
  }));
}

/**
 * One-shot celebratory confetti burst. Mount it only when a success state
 * first appears (e.g. inside an early-return "confirmed" branch) — it
 * generates its particles once and removes itself after the fall finishes.
 */
export default function Confetti() {
  const [particles] = useState<Particle[] | null>(() => {
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return null;
    }
    return makeParticles();
  });
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!particles) return;
    const timer = setTimeout(() => setVisible(false), DURATION_MS);
    return () => clearTimeout(timer);
  }, [particles]);

  if (!particles || !visible) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden pointer-events-none" aria-hidden="true">
      {particles.map((p) => (
        <span
          key={p.id}
          className={`confetti-piece absolute top-0 ${p.round ? "rounded-full" : "rounded-xs"}`}
          style={
            {
              left: `${p.left}%`,
              width: p.size,
              height: p.round ? p.size : p.size * 1.6,
              backgroundColor: p.color,
              "--confetti-delay": `${p.delay}s`,
              "--confetti-duration": `${p.duration}s`,
              "--confetti-spin": `${p.spin}deg`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
