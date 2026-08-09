"use client";

import { useState } from "react";

import { Eye, X } from "lucide-react";
import Link from "next/link";
import { createPortal } from "react-dom";

import { BookingAttendee } from "@/types";

interface TicketInfo {
  ticketId: string;
  seatId: string;
  attendeeName: string;
}

interface Props {
  bookingId: string;
  seatIds: string[];
  /** Full per-seat registration details collected at checkout — name, and
   *  whichever of phone/email/gender the attendee filled in. Already loaded
   *  with the booking row server-side, so no extra fetch needed for these. */
  attendees: BookingAttendee[];
  /** Only CONFIRMED bookings have real, issued (linkable) tickets. */
  hasTickets: boolean;
}

const GENDER_LABEL: Record<string, string> = {
  male: "Male",
  female: "Female",
  boy: "Boy",
  girl: "Girl",
  others: "Others",
};

/**
 * Compact seat count + an eye button that reveals every seat's full
 * registration details (attendee name, phone, email, gender) plus its
 * hyperlinked ticket once issued — keeps the Bookings table row to one line
 * even for bookings with many seats, instead of spelling everything out
 * inline.
 */
export default function BookingSeatsCell({ bookingId, seatIds, attendees, hasTickets }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tickets, setTickets] = useState<TicketInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const attendeeBySeat = new Map(attendees.map((a) => [a.seatId, a]));
  const ticketBySeat = new Map((tickets ?? []).map((t) => [t.seatId, t]));

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
        aria-label="View registration details"
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
                <h2 className="font-bold text-lg">Registration details</h2>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="text-slate-500 hover:text-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {hasTickets && loading && (
                <p className="text-xs text-slate-500 text-center mb-3">Loading ticket links…</p>
              )}
              {hasTickets && error && (
                <p className="text-xs text-red-700 text-center mb-3">{error}</p>
              )}

              <ul className="space-y-3 max-h-80 overflow-y-auto">
                {seatIds.map((seatId) => {
                  const attendee = attendeeBySeat.get(seatId);
                  const ticket = ticketBySeat.get(seatId);
                  const contact = [
                    attendee?.phone,
                    attendee?.email,
                    attendee?.gender ? GENDER_LABEL[attendee.gender] : undefined,
                  ].filter(Boolean);
                  return (
                    <li key={seatId} className="border-b border-slate-100 last:border-0 pb-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-mono text-sm text-slate-700">{seatId}</span>
                        {ticket && (
                          <Link
                            href={`/ticket/${ticket.ticketId}`}
                            className="font-mono text-xs text-[#1d4ed8] hover:underline truncate"
                          >
                            {ticket.ticketId}
                          </Link>
                        )}
                      </div>
                      <p className="text-sm font-medium text-slate-900 mt-0.5">
                        {attendee?.name || ticket?.attendeeName || "—"}
                      </p>
                      {contact.length > 0 && (
                        <p className="text-xs text-slate-500">{contact.join(" · ")}</p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>,
          document.body
        )}
    </span>
  );
}
