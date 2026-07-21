"use client";

import { useState } from "react";

import Link from "next/link";

import { BookingStatus } from "@/types";
import { formatDateIST, inr } from "@/utils";

import { useToast } from "../Toast";

interface LookupResult {
  bookingId: string;
  status: BookingStatus;
  eventTitle: string;
  startsAt: string | null;
  venue: string | null;
  seats: string[];
  amount: number;
  attendeeName: string;
  tickets: { ticketId: string; seatId: string; name: string }[];
}

const STATUS_COPY: Record<BookingStatus, { label: string; cls: string; hint: string }> = {
  CONFIRMED: {
    label: "Confirmed",
    cls: "bg-emerald-500/15 text-emerald-400",
    hint: "You're in! Open your ticket below.",
  },
  PENDING: {
    label: "Payment pending",
    cls: "bg-amber-500/15 text-amber-400",
    hint: "The payment hasn't been confirmed yet. If money was deducted, it will confirm shortly or be auto-refunded.",
  },
  FAILED: {
    label: "Not completed",
    cls: "bg-zinc-500/15 text-zinc-400",
    hint: "This booking was not completed and no seats are held. Any deducted money is auto-refunded by the bank.",
  },
  REFUNDED: {
    label: "Refunded",
    cls: "bg-sky-500/15 text-sky-400",
    hint: "This booking was refunded. The amount returns to your payment method in 5–7 working days.",
  },
};

export default function BookingLookup() {
  const [bookingId, setBookingId] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<LookupResult | null>(null);
  const { showToast, toast } = useToast();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/bookings/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId, email }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error ?? "Lookup failed", "error");
      } else {
        setResult(data);
      }
    } catch {
      showToast("Could not reach the server", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <form
        onSubmit={submit}
        className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-3"
      >
        <input
          name="bookingId"
          value={bookingId}
          onChange={(e) => setBookingId(e.target.value)}
          placeholder="Booking ID (e.g. BKG1752…)"
          required
          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#f84464]"
        />
        <input
          type="email"
          name="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email used while booking"
          required
          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#f84464]"
        />
        <button
          type="submit"
          disabled={busy || !bookingId.trim() || !email.trim()}
          className="w-full bg-[#f84464] hover:bg-[#e03a58] disabled:opacity-40 rounded-lg px-6 py-2.5 font-semibold text-sm transition-colors"
        >
          {busy ? "Checking…" : "Check status"}
        </button>
      </form>

      {result && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-3">
          <div className="flex items-center gap-3">
            <span
              className={`inline-block text-xs font-semibold px-2 py-0.5 rounded ${STATUS_COPY[result.status].cls}`}
            >
              {STATUS_COPY[result.status].label}
            </span>
            <span className="font-mono text-xs text-zinc-500">{result.bookingId}</span>
          </div>
          <p className="text-sm text-zinc-400">{STATUS_COPY[result.status].hint}</p>
          <div className="text-sm space-y-1.5 pt-2 border-t border-zinc-800">
            <p className="font-semibold wrap-break-word">{result.eventTitle}</p>
            {result.startsAt && (
              <p className="text-zinc-400">
                {formatDateIST(result.startsAt)}
                {result.venue ? ` · ${result.venue}` : ""}
              </p>
            )}
            <p className="text-zinc-400">
              {result.attendeeName} · Seats {result.seats.join(", ")} · {inr(result.amount)}
            </p>
          </div>
          {result.tickets.length > 0 && (
            <div className="space-y-2">
              {result.tickets.map((t) => (
                <Link
                  key={t.ticketId}
                  href={`/ticket/${t.ticketId}`}
                  className="block text-center bg-[#f84464] hover:bg-[#e03a58] rounded-lg px-6 py-2.5 font-semibold text-sm transition-colors"
                >
                  View ticket — {t.name} · Seat {t.seatId}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
      {toast}
    </div>
  );
}
