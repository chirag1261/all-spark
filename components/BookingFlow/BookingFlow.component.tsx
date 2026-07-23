"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Check, Tag, Users } from "lucide-react";
import Link from "next/link";

import { MAX_SEATS_PER_BOOKING } from "@/constants";
import { seatPrice } from "@/lib/domain/events";
import { EventItem } from "@/types";
import { formatDateIST, inr } from "@/utils";

import BackLink from "../BackLink";
import Confetti from "../Confetti";
import Loader from "../Loader";
import { useRouteLoader } from "../RouteLoader";
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
  /** Server-fetched seat availability so the map is accurate on first paint. */
  initialBookedSeats: string[];
  initialLockedSeats: string[];
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

export default function BookingFlow({
  event,
  customer,
  initialBookedSeats,
  initialLockedSeats,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bookedSeats, setBookedSeats] = useState<Set<string>>(new Set(initialBookedSeats));
  const [lockedSeats, setLockedSeats] = useState<Set<string>>(new Set(initialLockedSeats));
  // seatId -> attendee name; the first seat defaults to the purchaser's name
  const [attendeeNames, setAttendeeNames] = useState<Record<string, string>>({});
  const [paying, setPaying] = useState(false);
  // True from the moment payment succeeds until the tickets are confirmed and
  // we've navigated / rendered them — drives the full-screen loader.
  const [finalizing, setFinalizing] = useState(false);
  const { showToast, toast } = useToast();
  const [confirmed, setConfirmed] = useState<Confirmation | null>(null);
  // Guided checkout journey: pick seats → name attendees → review → pay.
  const [step, setStep] = useState<"seats" | "attendees" | "summary">("seats");
  // Promo code applied on the summary step (server-validated preview).
  const [promoInput, setPromoInput] = useState("");
  const [applyingPromo, setApplyingPromo] = useState(false);
  const [appliedPromo, setAppliedPromo] = useState<{ code: string; discount: number } | null>(null);
  const routeLoader = useRouteLoader();
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

  // What the customer actually pays after any applied promo (display only; the
  // server recomputes authoritatively in /api/orders).
  const payable = Math.max(0, totalAmount - (appliedPromo?.discount ?? 0));

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

  const goToAttendees = () => {
    if (selected.size === 0) return showToast("Select at least one seat to continue", "error");
    setStep("attendees");
  };

  const goToSummary = () => {
    // Same rule the pay() call enforces — validate here so the summary is complete.
    const missing = selectedSeats.some((seatId, i) => nameForSeat(seatId, i).trim().length < 2);
    if (missing) return showToast("Enter a name (2+ characters) for every seat", "error");
    setStep("summary");
  };

  // Going back to change seats/names invalidates any previewed discount — clear it.
  const clearPromo = () => {
    setAppliedPromo(null);
    setPromoInput("");
  };

  const applyPromo = async () => {
    const code = promoInput.trim().toUpperCase();
    if (!code) return;
    setApplyingPromo(true);
    try {
      const res = await fetch("/api/promo/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, eventId: event.id, seatIds: selectedSeats }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        showToast(data.error ?? "Could not apply that code", "error");
        setAppliedPromo(null);
        return;
      }
      setAppliedPromo({ code: data.code, discount: data.discount });
      showToast(`Promo ${data.code} applied`, "success");
    } catch {
      showToast("Could not reach the server", "error");
    } finally {
      setApplyingPromo(false);
    }
  };

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
        body: JSON.stringify({
          eventId: event.id,
          attendees,
          promoCode: appliedPromo?.code,
        }),
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
        theme: { color: "#d99a45" },
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
                // Hand off to the global buffer loader so the overlay persists
                // through the redirect and the ticket page's own render.
                routeLoader.navigate(
                  `/ticket/${encodeURIComponent(tickets[0].ticketId)}`,
                  "Preparing your ticket…"
                );
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
        <Confetti />
        <div className="tick-pop w-16 h-16 rounded-full bg-emerald-500/15 text-emerald-400 flex items-center justify-center mx-auto mb-5">
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
                  className="inline-block mt-2 text-sm text-[#d99a45] hover:underline"
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
            className="flex-1 bg-[#d99a45] hover:bg-[#bf863a] rounded-lg px-5 py-3 font-semibold text-sm transition-colors"
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
        Booking as <span className="text-zinc-300">{customer.name}</span> (
        {customer.email ?? customer.phone}).
      </p>

      <Stepper current={step} />

      {/* ---- Step 1: choose seats ---- */}
      {step === "seats" && (
        <div className="mt-6">
          <SeatMap
            event={event}
            bookedSeats={bookedSeats}
            lockedSeats={lockedSeats}
            selected={selected}
            onToggle={toggleSeat}
          />
          <div className="sticky bottom-0 mt-6 bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">
                {selected.size > 0 ? (
                  <>
                    {selected.size} seat{selected.size > 1 ? "s" : ""} · {inr(totalAmount)}
                  </>
                ) : (
                  "Select your seats"
                )}
              </p>
              {selected.size > 0 && (
                <p className="text-xs text-zinc-500 truncate">{selectedSeats.join(", ")}</p>
              )}
            </div>
            <button
              onClick={goToAttendees}
              disabled={selected.size === 0}
              className="bg-[#d99a45] hover:bg-[#bf863a] disabled:opacity-40 disabled:cursor-not-allowed rounded-lg px-6 py-2.5 font-semibold text-sm transition-colors"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* ---- Step 2: attendee names ---- */}
      {step === "attendees" && (
        <div className="mt-6 max-w-2xl">
          <p className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-zinc-500 mb-3">
            <Users className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            Attendee for each seat
            {selectedSeats.length > 1 && (
              <span className="normal-case text-zinc-600">
                — every person gets their own QR ticket
              </span>
            )}
          </p>
          <div className="grid sm:grid-cols-2 gap-2.5">
            {selectedSeats.map((seatId, i) => (
              <div key={seatId} className="flex items-center gap-2.5">
                <span className="h-10 shrink-0 flex items-center justify-center whitespace-nowrap text-[11px] font-mono font-semibold tracking-wide text-[#e8bd6b] bg-[#d99a45]/10 border border-[#d99a45]/25 rounded-lg px-3">
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
                  className="h-10 flex-1 min-w-0 bg-zinc-950 border border-zinc-800 rounded-lg px-3 text-sm outline-none focus:border-[#d99a45] transition-colors"
                />
              </div>
            ))}
          </div>
          <div className="flex gap-3 mt-6">
            <button
              onClick={() => {
                clearPromo(); // seats may change → any previewed discount is stale
                setStep("seats");
              }}
              className="rounded-lg border border-zinc-700 px-5 py-2.5 font-semibold text-sm text-zinc-300 hover:text-zinc-100 hover:border-zinc-600 transition-colors"
            >
              Back
            </button>
            <button
              onClick={goToSummary}
              className="flex-1 sm:flex-none bg-[#d99a45] hover:bg-[#bf863a] rounded-lg px-6 py-2.5 font-semibold text-sm transition-colors"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* ---- Step 3: review & pay ---- */}
      {step === "summary" && (
        <div className="mt-6 max-w-2xl">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-800">
              <p className="font-semibold">{event.title}</p>
              <p className="text-sm text-zinc-400">
                {event.venue} · {formatDateIST(event.startsAt)}
              </p>
            </div>
            <ul className="divide-y divide-zinc-800/70">
              {selectedSeats.map((seatId, i) => (
                <li key={seatId} className="flex items-center gap-3 px-5 py-3">
                  <span className="shrink-0 whitespace-nowrap text-[11px] font-mono font-semibold tracking-wide text-[#e8bd6b] bg-[#d99a45]/10 border border-[#d99a45]/25 rounded-lg px-2.5 py-1">
                    {seatId}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm">{nameForSeat(seatId, i)}</span>
                  <span className="shrink-0 text-sm text-zinc-400">
                    {inr(seatPrice(event, seatId) ?? 0)}
                  </span>
                </li>
              ))}
            </ul>
            <div className="px-5 py-4 border-t border-zinc-800 space-y-1.5">
              <div className="flex items-center justify-between text-sm text-zinc-400">
                <span>
                  Subtotal · {selected.size} seat{selected.size > 1 ? "s" : ""}
                </span>
                <span>{inr(totalAmount)}</span>
              </div>
              {appliedPromo && (
                <div className="flex items-center justify-between text-sm text-emerald-400">
                  <span>Promo {appliedPromo.code}</span>
                  <span>−{inr(appliedPromo.discount)}</span>
                </div>
              )}
              <div className="flex items-center justify-between pt-1.5 border-t border-zinc-800/70">
                <span className="text-sm text-zinc-300">Total payable</span>
                <span className="text-lg font-bold">{inr(payable)}</span>
              </div>
            </div>
          </div>

          {/* Promo code */}
          <div className="mt-4">
            {appliedPromo ? (
              <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
                <Tag className="w-4 h-4 shrink-0 text-emerald-400" aria-hidden="true" />
                <span className="text-sm">
                  <span className="font-semibold">{appliedPromo.code}</span> applied — you save{" "}
                  {inr(appliedPromo.discount)}
                </span>
                <button
                  onClick={clearPromo}
                  disabled={paying}
                  className="ml-auto text-sm text-zinc-400 hover:text-zinc-200 disabled:opacity-40"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  value={promoInput}
                  onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      applyPromo();
                    }
                  }}
                  placeholder="Promo code"
                  className="flex-1 min-w-0 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm font-mono tracking-wide uppercase outline-none focus:border-[#d99a45]"
                />
                <button
                  onClick={applyPromo}
                  disabled={applyingPromo || !promoInput.trim()}
                  className="shrink-0 rounded-lg border border-zinc-700 px-5 py-2.5 font-semibold text-sm text-zinc-200 hover:border-zinc-600 disabled:opacity-40 transition-colors"
                >
                  {applyingPromo ? "Applying…" : "Apply"}
                </button>
              </div>
            )}
          </div>

          <p className="text-xs text-zinc-500 mt-4">
            Your seats are held for 8 minutes once you proceed to payment.
          </p>

          <div className="flex gap-3 mt-5">
            <button
              onClick={() => setStep("attendees")}
              disabled={paying}
              className="rounded-lg border border-zinc-700 px-5 py-2.5 font-semibold text-sm text-zinc-300 hover:text-zinc-100 hover:border-zinc-600 disabled:opacity-40 transition-colors"
            >
              Back
            </button>
            <button
              onClick={pay}
              disabled={paying || selected.size === 0}
              className="flex-1 bg-[#d99a45] hover:bg-[#bf863a] disabled:opacity-40 disabled:cursor-not-allowed rounded-lg px-6 py-2.5 font-semibold text-sm transition-colors"
            >
              {paying ? "Processing…" : `Proceed to payment · ${inr(payable)}`}
            </button>
          </div>
        </div>
      )}
      {toast}
    </div>
  );
}

const STEPS: { key: "seats" | "attendees" | "summary"; label: string }[] = [
  { key: "seats", label: "Seats" },
  { key: "attendees", label: "Attendees" },
  { key: "summary", label: "Review" },
];

function Stepper({ current }: { current: "seats" | "attendees" | "summary" }) {
  const currentIdx = STEPS.findIndex((s) => s.key === current);
  return (
    <ol className="flex items-center gap-2 sm:gap-3">
      {STEPS.map((s, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        return (
          <li key={s.key} className="flex items-center gap-2 sm:gap-3 min-w-0">
            <span
              className={`flex items-center gap-2 ${active ? "" : "opacity-70"}`}
              aria-current={active ? "step" : undefined}
            >
              <span
                className={`w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${
                  done
                    ? "bg-[#d99a45] text-[#1a1206]"
                    : active
                      ? "bg-[#d99a45]/20 text-[#e8bd6b] ring-1 ring-[#d99a45]"
                      : "bg-zinc-800 text-zinc-500"
                }`}
              >
                {done ? <Check className="w-3.5 h-3.5" aria-hidden="true" /> : i + 1}
              </span>
              <span
                className={`text-sm font-medium ${active ? "text-zinc-100" : "text-zinc-500"}`}
              >
                {s.label}
              </span>
            </span>
            {i < STEPS.length - 1 && (
              <span className="w-4 sm:w-8 h-px bg-zinc-700 shrink-0" aria-hidden="true" />
            )}
          </li>
        );
      })}
    </ol>
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
