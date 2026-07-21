"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Check } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { MAX_SEATS_PER_BOOKING } from "@/constants";
import { seatPrice } from "@/lib/domain/events";
import { EventItem } from "@/types";
import { formatDateIST, inr } from "@/utils";

import BackLink from "../BackLink";
import Loader from "../Loader";
import SeatMap from "../SeatMap";
import { useToast } from "../Toast";

interface TicketView {
  ticketId: string;
  seatId: string;
  name: string;
  qrDataUrl: string;
}

interface Confirmation {
  bookingId: string;
  tickets: TicketView[];
  emailSent: boolean;
  amount: number;
}

interface Props {
  event: EventItem;
  /** The signed-in customer (booking is gated on login server-side). */
  customer: { name: string; email: string | null; phone: string | null };
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

const RZP_SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";

function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = RZP_SCRIPT;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function BookingFlow({ event, customer }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bookedSeats, setBookedSeats] = useState<Set<string>>(new Set());
  const [lockedSeats, setLockedSeats] = useState<Set<string>>(new Set());
  // seatId -> attendee name; the first seat defaults to the purchaser's name
  const [attendeeNames, setAttendeeNames] = useState<Record<string, string>>({});
  const [paying, setPaying] = useState(false);
  // True from the moment payment succeeds until the tickets are confirmed and
  // we've navigated / rendered them — drives the full-screen loader.
  const [finalizing, setFinalizing] = useState(false);
  const { showToast, toast } = useToast();
  const [confirmed, setConfirmed] = useState<Confirmation | null>(null);
  const router = useRouter();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshSeats = useCallback(async () => {
    try {
      const res = await fetch(`/api/seats?eventId=${encodeURIComponent(event.id)}`);
      if (!res.ok) return;
      const data = await res.json();
      setBookedSeats(new Set(data.booked));
      setLockedSeats(new Set(data.locked));
    } catch {
      /* transient network error — keep last known state */
    }
  }, [event.id]);

  // Poll seat availability so other users' locks show up in near-real-time.
  useEffect(() => {
    if (confirmed) return;
    const first = setTimeout(refreshSeats, 0);
    pollRef.current = setInterval(refreshSeats, 5000);
    return () => {
      clearTimeout(first);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [refreshSeats, confirmed]);

  const selectedSeats = useMemo(() => [...selected].sort(), [selected]);

  const totalAmount = useMemo(() => {
    let sum = 0;
    for (const id of selected) sum += seatPrice(event, id) ?? 0;
    return sum;
  }, [selected, event]);

  const toggleSeat = (seatId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(seatId)) {
        next.delete(seatId);
      } else {
        if (next.size >= MAX_SEATS_PER_BOOKING) {
          showToast(`You can book at most ${MAX_SEATS_PER_BOOKING} seats`, "error");
          return prev;
        }
        next.add(seatId);
      }
      return next;
    });
  };

  const nameForSeat = (seatId: string, index: number) =>
    attendeeNames[seatId] ?? (index === 0 ? customer.name : "");

  const pay = async () => {
    if (paying) return;

    if (selected.size === 0) return showToast("Select at least one seat", "error");
    const attendees = selectedSeats.map((seatId, i) => ({
      seatId,
      name: nameForSeat(seatId, i).trim(),
    }));
    const missing = attendees.find((a) => a.name.length < 2);
    if (missing) {
      return showToast(`Enter the attendee's name for seat ${missing.seatId}`, "error");
    }

    setPaying(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: event.id, attendees }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPaying(false);
        if (res.status === 401) {
          window.location.href = `/login?next=${encodeURIComponent(`/events/${event.id}/book`)}`;
          return;
        }
        if (res.status === 409 && data.conflicts) {
          showToast(`Seats just taken by someone else: ${data.conflicts.join(", ")}`, "error");
          setSelected((prev) => {
            const next = new Set(prev);
            for (const c of data.conflicts) next.delete(c);
            return next;
          });
          refreshSeats();
        } else {
          showToast(data.error ?? "Could not start payment", "error");
        }
        return;
      }

      const ok = await loadRazorpay();
      if (!ok || !window.Razorpay) {
        await fetch("/api/release", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: data.orderId, releaseToken: data.releaseToken }),
        }).catch(() => {});
        showToast("Could not load the payment window. Check your connection and retry.", "error");
        setPaying(false);
        return;
      }

      const rzp = new window.Razorpay({
        key: data.keyId,
        amount: data.amount,
        currency: data.currency,
        name: event.title,
        description: `Seats ${selectedSeats.join(", ")}`,
        order_id: data.orderId,
        prefill: data.prefill,
        theme: { color: "#f5a524" },
        handler: async (resp: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          // Payment went through — cover the verify + redirect with a loader.
          setFinalizing(true);
          try {
            const verifyRes = await fetch("/api/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(resp),
            });
            const verifyData = await verifyRes.json();
            if (verifyRes.ok && verifyData.status === "CONFIRMED") {
              const tickets: TicketView[] = verifyData.tickets ?? [];
              // Single ticket → straight to its ticket screen. Multiple → show
              // the all-tickets confirmation (each attendee's QR at once).
              if (tickets.length === 1) {
                router.push(`/ticket/${encodeURIComponent(tickets[0].ticketId)}`);
                return; // keep the loader up through navigation (no setPaying)
              }
              setConfirmed({
                bookingId: verifyData.bookingId,
                tickets,
                emailSent: verifyData.emailSent ?? false,
                amount: verifyData.amount,
              });
            } else {
              setFinalizing(false);
              showToast(
                verifyData.error ??
                  "Payment verification failed. If money was deducted it will be auto-refunded.",
                "error"
              );
              refreshSeats();
            }
          } catch {
            setFinalizing(false);
            showToast("Could not verify payment — check My Bookings before retrying.", "error");
          } finally {
            setPaying(false);
          }
        },
        modal: {
          ondismiss: async () => {
            // User closed checkout without paying — free the held seats.
            await fetch("/api/release", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ orderId: data.orderId, releaseToken: data.releaseToken }),
            }).catch(() => {});
            setPaying(false);
            refreshSeats();
          },
        },
      });
      rzp.open();
      // paying stays true until handler/ondismiss resolves
    } catch {
      showToast("Something went wrong. Please try again.", "error");
      setPaying(false);
    }
  };

  // ---------- Confirmation: one QR ticket per attendee ----------

  if (confirmed) {
    return (
      <div className="max-w-lg mx-auto text-center py-12">
        <div className="w-16 h-16 rounded-full bg-emerald-500/15 text-emerald-400 flex items-center justify-center mx-auto mb-5">
          <Check className="w-8 h-8" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-bold mb-1">Booking confirmed!</h1>
        <p className="text-zinc-400 text-sm mb-2">
          {confirmed.tickets.length > 1
            ? `${confirmed.tickets.length} tickets — each attendee shows their own QR at the gate.`
            : "Show this QR at the venue gate."}
        </p>
        <p className="text-zinc-500 text-sm mb-8">
          {confirmed.emailSent
            ? `Tickets were emailed to ${customer.email}.`
            : "Save your tickets — they're also in My Tickets in your account."}
        </p>

        <div className="space-y-4 text-left">
          {confirmed.tickets.map((t) => (
            <div
              key={t.ticketId}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex items-center gap-5"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={t.qrDataUrl}
                alt={`Ticket QR ${t.ticketId}`}
                className="w-28 h-28 rounded-lg bg-white p-1 shrink-0"
              />
              <div className="min-w-0">
                <p className="font-bold wrap-break-word">{t.name}</p>
                <p className="text-sm text-zinc-400">Seat {t.seatId}</p>
                <p className="font-mono text-xs text-zinc-500 mt-1 wrap-break-word">{t.ticketId}</p>
                <Link
                  href={`/ticket/${t.ticketId}`}
                  className="inline-block mt-2 text-sm text-[#f5a524] hover:underline"
                >
                  View / share ticket
                </Link>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 mt-4 text-left space-y-2">
          <Row label="Booking ID" value={confirmed.bookingId} mono />
          <Row label="Event" value={event.title} />
          <Row label="When" value={formatDateIST(event.startsAt)} />
          <Row label="Amount paid" value={inr(confirmed.amount)} strong />
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mt-6">
          <Link
            href="/account/tickets"
            className="flex-1 bg-zinc-800 hover:bg-zinc-700 rounded-lg px-5 py-3 font-semibold text-sm transition-colors"
          >
            My tickets
          </Link>
          <Link
            href="/"
            className="flex-1 bg-[#f5a524] hover:bg-[#d98c1f] rounded-lg px-5 py-3 font-semibold text-sm transition-colors"
          >
            Browse more events
          </Link>
        </div>
      </div>
    );
  }

  // ---------- Seat selection + attendee details ----------

  return (
    <div>
      {finalizing && <Loader fullscreen label="Payment successful — preparing your tickets…" />}
      <BackLink href={`/events/${event.id}`} className="mb-4">
        Back to event
      </BackLink>
      <div className="flex flex-wrap items-baseline gap-x-3 mb-1">
        <h1 className="text-xl font-bold wrap-break-word">{event.title}</h1>
        <span className="text-sm text-zinc-400">
          {event.venue} · {formatDateIST(event.startsAt)}
        </span>
      </div>
      <p className="text-xs text-zinc-500 mb-6">
        Seats are held for 8 minutes once you proceed to pay. Booking as{" "}
        <span className="text-zinc-300">{customer.name}</span> ({customer.email ?? customer.phone}).
      </p>

      <SeatMap
        event={event}
        bookedSeats={bookedSeats}
        lockedSeats={lockedSeats}
        selected={selected}
        onToggle={toggleSeat}
      />

      {/* Checkout bar */}
      <div className="sticky bottom-0 mt-6 bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
        {selectedSeats.length > 0 && (
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500 mb-2">
              Attendee for each seat{" "}
              {selectedSeats.length > 1 && "— every person gets their own QR ticket"}
            </p>
            <div className="grid sm:grid-cols-2 gap-2">
              {selectedSeats.map((seatId, i) => (
                <div key={seatId} className="flex items-center gap-2">
                  <span className="w-12 shrink-0 text-center text-xs font-mono bg-zinc-800 rounded-md py-2.5">
                    {seatId}
                  </span>
                  <input
                    value={nameForSeat(seatId, i)}
                    onChange={(e) =>
                      setAttendeeNames((prev) => ({ ...prev, [seatId]: e.target.value }))
                    }
                    placeholder={`Attendee name for ${seatId}`}
                    required
                    minLength={2}
                    maxLength={80}
                    className="flex-1 min-w-0 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#f5a524]"
                  />
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <div className="flex-1">
            <p className="text-sm font-medium">
              {selected.size > 0 ? (
                <>
                  {selected.size} seat{selected.size > 1 ? "s" : ""} · {selectedSeats.join(", ")}
                </>
              ) : (
                "Select your seats"
              )}
            </p>
          </div>
          <button
            onClick={pay}
            disabled={paying || selected.size === 0}
            className="bg-[#f5a524] hover:bg-[#d98c1f] disabled:opacity-40 disabled:cursor-not-allowed rounded-lg px-6 py-2.5 font-semibold text-sm transition-colors"
          >
            {paying ? "Processing…" : selected.size > 0 ? `Pay ${inr(totalAmount)}` : "Pay"}
          </button>
        </div>
      </div>
      {toast}
    </div>
  );
}

function Row({
  label,
  value,
  mono,
  strong,
}: {
  label: string;
  value: string;
  mono?: boolean;
  strong?: boolean;
}) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-zinc-500">{label}</span>
      <span
        className={`${mono ? "font-mono" : ""} ${strong ? "font-bold text-base" : ""} text-right wrap-break-word min-w-0`}
      >
        {value}
      </span>
    </div>
  );
}
