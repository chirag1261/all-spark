"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import dynamic from "next/dynamic";

const QrScanner = dynamic(() => import("@/components/QrScanner"), { ssr: false });

interface EventOption {
  id: string;
  title: string;
}

type ScanResult =
  | "VALID"
  | "ALREADY_USED"
  | "WRONG_EVENT"
  | "NOT_CONFIRMED"
  | "NOT_FOUND"
  | "INVALID"
  | "UNREADABLE";

interface Outcome {
  result: ScanResult;
  name?: string;
  seat?: string;
  scannedByName?: string | null;
  scannedAt?: number | null;
  ticketEvent?: string;
  at: number;
}

const RESULT_COPY: Record<ScanResult, { title: string; ok: boolean }> = {
  VALID: { title: "Checked in", ok: true },
  ALREADY_USED: { title: "Already used", ok: false },
  WRONG_EVENT: { title: "Wrong event", ok: false },
  NOT_CONFIRMED: { title: "Not a confirmed ticket", ok: false },
  NOT_FOUND: { title: "Ticket not found", ok: false },
  INVALID: { title: "Invalid / forged QR", ok: false },
  UNREADABLE: { title: "Unrecognized code", ok: false },
};

/** WebAudio feedback — no asset files. Rising two-tone for success, low buzz for failure. */
function beep(ok: boolean) {
  try {
    const Ctx =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const play = (freq: number, start: number, dur: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      osc.type = ok ? "sine" : "square";
      gain.gain.setValueAtTime(0.15, ctx.currentTime + start);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + dur);
    };
    if (ok) {
      play(880, 0, 0.12);
      play(1320, 0.12, 0.16);
    } else {
      play(180, 0, 0.4);
    }
  } catch {
    /* audio not available — ignore */
  }
}

export default function ScanConsole({ events }: { events: EventOption[] }) {
  // Picked in the event dropdown, before scanning has started.
  const [pendingEventId, setPendingEventId] = useState(events[0]?.id ?? "");
  // Confirmed event the camera is actually scanning for — empty until the
  // admin explicitly presses "Start scanning", so the camera never opens
  // before an event has been chosen.
  const [eventId, setEventId] = useState("");
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [log, setLog] = useState<Outcome[]>([]);
  const [counts, setCounts] = useState<{ sold: number; checkedIn: number } | null>(null);
  const [busy, setBusy] = useState(false);

  // Debounce: ignore the same code re-read within the cooldown or while in flight.
  const lastRef = useRef<{ text: string; at: number }>({ text: "", at: 0 });
  const inFlight = useRef(false);

  const refreshCounts = useCallback(async () => {
    if (!eventId) return;
    try {
      const res = await fetch(`/api/admin/attendance?eventId=${encodeURIComponent(eventId)}`);
      if (res.ok) {
        const data = await res.json();
        setCounts(data.counts);
      }
    } catch {
      /* transient — next poll retries */
    }
  }, [eventId]);

  // Live counter poll (~5s) while an event is selected.
  useEffect(() => {
    if (!eventId) return;
    const first = setTimeout(refreshCounts, 0);
    const id = setInterval(refreshCounts, 5000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [eventId, refreshCounts]);

  const record = (o: Outcome) => {
    setOutcome(o);
    setLog((prev) => [o, ...prev].slice(0, 25));
    beep(RESULT_COPY[o.result].ok);
  };

  const handleDecode = useCallback(
    async (text: string) => {
      const now = Date.now();
      if (inFlight.current) return;
      if (text === lastRef.current.text && now - lastRef.current.at < 2500) return;
      lastRef.current = { text, at: now };

      let ticketId = "";
      let sig = "";
      try {
        const parsed = JSON.parse(text);
        ticketId = typeof parsed.t === "string" ? parsed.t : "";
        sig = typeof parsed.sig === "string" ? parsed.sig : "";
      } catch {
        /* not our JSON payload */
      }
      if (!ticketId) {
        record({ result: "UNREADABLE", at: now });
        return;
      }

      inFlight.current = true;
      setBusy(true);
      try {
        const res = await fetch("/api/admin/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ticketId, sig, eventId }),
        });
        const data = await res.json();
        if (!res.ok) {
          record({ result: "INVALID", at: now });
        } else {
          record({ ...data, at: now });
          if (data.result === "VALID") refreshCounts();
        }
      } catch {
        record({ result: "UNREADABLE", at: now });
      } finally {
        inFlight.current = false;
        setBusy(false);
      }
    },
    [eventId, refreshCounts]
  );

  const copy = outcome ? RESULT_COPY[outcome.result] : null;
  const selectedEvent = events.find((e) => e.id === eventId);

  const startScanning = () => {
    if (!pendingEventId) return;
    setOutcome(null);
    setLog([]);
    setCounts(null);
    setEventId(pendingEventId);
  };

  // Not scanning yet — ask which event first. The camera never mounts until
  // this is confirmed.
  if (!eventId) {
    return (
      <div className="max-w-sm mx-auto space-y-4">
        <div>
          <label className="block text-xs text-slate-500 mb-1.5">Select event to scan</label>
          <select
            value={pendingEventId}
            onChange={(e) => setPendingEventId(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#1d4ed8]"
          >
            {events.length === 0 && <option value="">No published events</option>}
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={startScanning}
          disabled={!pendingEventId}
          className="w-full bg-[#1d4ed8] hover:bg-[#1e40af] disabled:opacity-40 disabled:cursor-not-allowed rounded-lg px-6 py-2.5 font-semibold text-sm transition-colors"
        >
          Start scanning
        </button>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <p className="text-sm text-slate-600">
            Scanning for <span className="font-medium text-slate-900">{selectedEvent?.title}</span>
          </p>
          <button
            type="button"
            onClick={() => setEventId("")}
            className="ml-auto text-xs text-[#1d4ed8] hover:underline"
          >
            Change event
          </button>
        </div>

        <QrScanner onDecode={handleDecode} />

        {counts && (
          <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <Stat label="Checked in" value={counts.checkedIn} accent="text-emerald-700" />
            <div className="h-8 w-px bg-slate-100" />
            <Stat label="Tickets sold" value={counts.sold} accent="text-slate-800" />
            <div className="ml-auto text-xs text-slate-500">
              {counts.sold - counts.checkedIn} pending
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {/* Result card */}
        <div
          className={`flex items-center gap-4 rounded-2xl border p-5 min-h-26 transition-colors ${
            !copy
              ? "border-slate-200 bg-slate-50 text-slate-500"
              : copy.ok
                ? "border-emerald-500/40 bg-emerald-50"
                : "border-red-500/40 bg-red-50"
          }`}
        >
          {busy ? (
            <Loader2 className="h-10 w-10 shrink-0 animate-spin text-slate-600" />
          ) : !copy ? (
            <p className="text-sm">Point the camera at a ticket QR to check it in.</p>
          ) : (
            <>
              {copy.ok ? (
                <CheckCircle2 className="h-10 w-10 shrink-0 text-emerald-700" />
              ) : (
                <XCircle className="h-10 w-10 shrink-0 text-red-700" />
              )}
              <div className="min-w-0">
                <p className={`font-semibold ${copy.ok ? "text-emerald-700" : "text-red-700"}`}>
                  {copy.title}
                </p>
                {outcome?.name && (
                  <p className="text-sm text-slate-800 truncate">
                    {outcome.name} · Seat {outcome.seat}
                  </p>
                )}
                {outcome?.result === "ALREADY_USED" && outcome.scannedByName && (
                  <p className="text-xs text-slate-600">
                    First scanned by {outcome.scannedByName}
                    {outcome.scannedAt
                      ? ` at ${new Date(outcome.scannedAt).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })}`
                      : ""}
                  </p>
                )}
                {outcome?.result === "WRONG_EVENT" && outcome.ticketEvent && (
                  <p className="text-xs text-slate-600">This ticket is for {outcome.ticketEvent}</p>
                )}
              </div>
            </>
          )}
        </div>

        {/* Session log */}
        <div className="rounded-2xl border border-slate-200 overflow-hidden">
          <p className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-slate-500 border-b border-slate-200 bg-slate-50">
            This session
          </p>
          {log.length === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-400 text-center">No scans yet.</p>
          ) : (
            <ul className="divide-y divide-slate-200 max-h-72 overflow-y-auto">
              {log.map((o, i) => {
                const c = RESULT_COPY[o.result];
                return (
                  <li key={`${o.at}-${i}`} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                    {c.ok ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700" />
                    ) : (
                      <XCircle className="h-4 w-4 shrink-0 text-red-700" />
                    )}
                    <span className="truncate">
                      {o.name ? `${o.name} · Seat ${o.seat}` : c.title}
                    </span>
                    <span className="ml-auto text-xs text-slate-400">
                      {new Date(o.at).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div>
      <p className={`text-2xl font-bold ${accent}`}>{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}
