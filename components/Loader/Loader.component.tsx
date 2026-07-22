"use client";

import { useEffect, useState } from "react";

import { CalendarDays, Music, Ticket, Users } from "lucide-react";

interface Props {
  /** Message shown under the icon. */
  label?: string;
  /** Render as a fixed full-screen overlay instead of an inline spinner. */
  fullscreen?: boolean;
}

// Tickets → people → shows → events: the booking journey, looping. Fast
// enough that even a brief loading flash shows several icons (~3/sec).
const ICONS = [Ticket, Users, Music, CalendarDays];
const STEP_MS = 320;

/** Shared loading indicator — a cycling icon animation, inline or full-screen. */
export default function Loader({ label, fullscreen }: Props) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setIndex((i) => (i + 1) % ICONS.length), STEP_MS);
    return () => clearInterval(timer);
  }, []);

  const body = (
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-14 h-14">
        {ICONS.map((Icon, i) => {
          const active = i === index;
          return (
            <div
              key={i}
              className={`absolute inset-0 flex items-center justify-center rounded-2xl bg-[#d99a45]/10 border border-[#d99a45]/25 transition-all duration-200 ${
                active
                  ? "opacity-100 scale-100 rotate-0"
                  : "opacity-0 scale-50 " + (i < index ? "-rotate-12" : "rotate-12")
              }`}
              style={{ transitionTimingFunction: "cubic-bezier(0.34, 1.56, 0.64, 1)" }}
            >
              <Icon className="w-7 h-7 text-[#d99a45]" aria-hidden="true" />
            </div>
          );
        })}
      </div>
      {label && <p className="text-sm text-zinc-300">{label}</p>}
      <span className="sr-only">Loading</span>
    </div>
  );

  if (!fullscreen) return body;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0d0a1f]/90 backdrop-blur-sm animate-[fade-in_.15s_ease-out]"
    >
      {body}
    </div>
  );
}
