"use client";

import { useState } from "react";

import { Eye, X } from "lucide-react";
import Link from "next/link";
import { createPortal } from "react-dom";

interface TicketInfo {
  ticketId: string;
  seatId: string;
  attendeeName: string;
}

interface Props {
  bookingId: string;
  seatIds: string[];
  /** Only CONFIRMED bookings have real, issued (linkable) tickets. */
  hasTickets: boolean;
}

/**
 * Compact seat count + an eye button that reveals every seat's hyperlinked
 * ticket in a popover — keeps the Bookings table row to one line even for
 * bookings with many seats, instead of spelling out every seat ID inline.
 */
export default function BookingSeatsCell({ bookingId, seatIds, hasTickets }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tickets, setTickets] = useState<TicketInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const openPopover = async () => {
    setOpen(true);
    if (!hasTickets || tickets) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/tickets?bookingId=${encodeURIComponent(bookingId)}`);
      const data = await res.json();
      if (res.ok) {
        setTickets(data.tickets);
      } else {
        setError(data.error ?? "Could not load tickets");
      }
    } catch {
      setError("Could not reach the server");
    } finally {
      setLoading(false);
    }
  };

  const seatLabel = `${seatIds.length} seat${seatIds.length === 1 ? "" : "s"}`;

  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      {seatLabel}
      <button
        type="button"
        onClick={openPopover}
        aria-label="View seats and tickets"
        className="inline-flex items-center justify-center w-6 h-6 rounded text-slate-500 hover:text-[#1d4ed8] hover:bg-slate-100 transition-colors"
      >
        <Eye className="w-3.5 h-3.5" aria-hidden="true" />
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
          >
            <button
              aria-label="Close"
              onClick={() => setOpen(false)}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm cursor-default animate-[fade-in_.15s_ease-out]"
            />
            <div className="relative w-full max-w-sm bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl animate-[dialog-in_.15s_ease-out]">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-lg">{seatLabel}</h2>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="text-slate-500 hover:text-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {!hasTickets ? (
                <ul className="space-y-1.5 text-sm text-slate-700 max-h-80 overflow-y-auto">
                  {seatIds.map((s) => (
                    <li key={s} className="font-mono">
                      {s}
                    </li>
                  ))}
                </ul>
              ) : loading ? (
                <p className="text-sm text-slate-500 text-center py-6">Loading tickets…</p>
              ) : error ? (
                <p className="text-sm text-red-700 text-center py-6">{error}</p>
              ) : (
                <ul className="space-y-2 max-h-80 overflow-y-auto">
                  {(tickets ?? []).map((t) => (
                    <li
                      key={t.ticketId}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <span className="font-mono text-slate-700 shrink-0">{t.seatId}</span>
                      <Link
                        href={`/ticket/${t.ticketId}`}
                        className="font-mono text-[#1d4ed8] hover:underline truncate"
                      >
                        {t.ticketId}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>,
          document.body
        )}
    </span>
  );
}
