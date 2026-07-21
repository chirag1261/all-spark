"use client";

import { useEffect, useState } from "react";

import { Clock } from "lucide-react";

interface Props {
  /** ISO datetime the countdown ticks down to (the event's start time). */
  targetIso: string;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  done: boolean;
}

function timeLeft(targetMs: number, nowMs: number): TimeLeft {
  const ms = Math.max(0, targetMs - nowMs);
  const totalSeconds = Math.floor(ms / 1000);
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    done: ms <= 0,
  };
}

/**
 * Live D:H:M:S countdown to an event's start. Renders nothing until mounted
 * (avoids an SSR/client clock mismatch) and nothing once the target has
 * passed — the parent doesn't need to separately gate on a stale "days to
 * go" number computed at request time.
 */
export default function CountdownTimer({ targetIso }: Props) {
  const target = new Date(targetIso).getTime();
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const first = setTimeout(() => setNow(Date.now()), 0);
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);

  if (now === null) return null;
  const t = timeLeft(target, now);
  if (t.done) return null;

  return (
    <div className="mb-6">
      <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.25em] text-white/60 mb-2">
        <Clock className="w-3 h-3" aria-hidden="true" />
        Event starts in
      </p>
      <div
        role="timer"
        aria-live="off"
        className="inline-flex items-stretch gap-px rounded-2xl overflow-hidden border border-white/15 bg-white/10 backdrop-blur-md shadow-[0_8px_30px_rgba(0,0,0,0.35)]"
      >
        <TimeBlock value={t.days} label={t.days === 1 ? "Day" : "Days"} />
        <Sep />
        <TimeBlock value={t.hours} label="Hrs" />
        <Sep />
        <TimeBlock value={t.minutes} label="Min" />
        <Sep />
        <TimeBlock value={t.seconds} label="Sec" accent />
      </div>
    </div>
  );
}

function TimeBlock({ value, label, accent }: { value: number; label: string; accent?: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center px-3.5 py-2 sm:px-4 sm:py-2.5 min-w-13 sm:min-w-15 bg-white/5">
      <span
        className={`font-mono text-xl sm:text-2xl font-bold tabular-nums leading-none ${
          accent ? "text-[#ff6b85]" : "text-white"
        }`}
      >
        {String(value).padStart(2, "0")}
      </span>
      <span className="text-[9px] sm:text-[10px] uppercase tracking-widest text-white/55 mt-1">
        {label}
      </span>
    </div>
  );
}

function Sep() {
  return <span className="w-px bg-white/10" aria-hidden="true" />;
}
