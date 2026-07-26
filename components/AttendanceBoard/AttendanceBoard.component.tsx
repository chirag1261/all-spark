"use client";

import { useCallback, useEffect, useState } from "react";

interface EventOption {
  id: string;
  title: string;
}

interface Attendee {
  ticketId: string;
  name: string;
  seat: string;
  status: "IN" | "PENDING";
  scannedAt: number | null;
  scannedByName: string | null;
}

/**
 * Live event-entry dashboard: sold-vs-checked-in counters and the attendee
 * list, polled every ~5s (the app is serverless, so polling rather than
 * WebSockets). Reads the same endpoint the scanner writes to.
 */
export default function AttendanceBoard({ events }: { events: EventOption[] }) {
  const [eventId, setEventId] = useState(events[0]?.id ?? "");
  const [counts, setCounts] = useState<{ sold: number; checkedIn: number } | null>(null);
  const [attendees, setAttendees] = useState<Attendee[]>([]);

  const refresh = useCallback(async () => {
    if (!eventId) return;
    try {
      const res = await fetch(`/api/admin/attendance?eventId=${encodeURIComponent(eventId)}`);
      if (res.ok) {
        const data = await res.json();
        setCounts(data.counts);
        setAttendees(data.attendees);
      }
    } catch {
      /* transient — next poll retries */
    }
  }, [eventId]);

  useEffect(() => {
    if (!eventId) return;
    const first = setTimeout(refresh, 0);
    const id = setInterval(refresh, 5000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [eventId, refresh]);

  const pct = counts && counts.sold > 0 ? Math.round((counts.checkedIn / counts.sold) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="max-w-sm">
        <label className="block text-sm text-slate-800 mb-1.5">Event</label>
        <select
          value={eventId}
          onChange={(e) => {
            setEventId(e.target.value);
            setCounts(null);
            setAttendees([]);
          }}
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

      {counts && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <div className="flex items-end gap-6">
            <div>
              <p className="text-3xl font-bold text-emerald-700">{counts.checkedIn}</p>
              <p className="text-sm text-slate-800">Checked in</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-slate-800">{counts.sold}</p>
              <p className="text-sm text-slate-800">Tickets sold</p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-3xl font-bold text-[#1d4ed8]">{pct}%</p>
              <p className="text-sm text-slate-800">Attendance</p>
            </div>
          </div>
          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      <div className="overflow-x-auto border border-slate-200 rounded-xl">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-white bg-[#1d4ed8]">
              <th className="px-4 py-3 font-medium">Attendee</th>
              <th className="px-4 py-3 font-medium">Seat</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Checked in</th>
              <th className="px-4 py-3 font-medium">By</th>
            </tr>
          </thead>
          <tbody>
            {attendees.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-700">
                  No tickets issued for this event yet.
                </td>
              </tr>
            ) : (
              attendees.map((a) => (
                <tr key={a.ticketId} className="border-b border-slate-200 last:border-0">
                  <td className="px-4 py-3">{a.name}</td>
                  <td className="px-4 py-3 text-slate-600">{a.seat}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block text-sm font-semibold px-2 py-0.5 rounded ${
                        a.status === "IN"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {a.status === "IN" ? "In" : "Pending"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap text-sm">
                    {a.scannedAt
                      ? new Date(a.scannedAt).toLocaleString("en-IN", {
                          timeZone: "Asia/Kolkata",
                          dateStyle: "medium",
                          timeStyle: "short",
                        })
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{a.scannedByName ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
