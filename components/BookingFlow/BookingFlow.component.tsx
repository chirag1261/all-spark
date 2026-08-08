"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";



import { AlertTriangle, Check, Tag, Users } from "lucide-react";
import Link from "next/link";
import { createPortal } from "react-dom";



import { MAX_SEATS_PER_BOOKING, SEAT_LOCK_TTL_MS } from "@/constants";
import { getSeatLayout, seatPrice, totalSeats } from "@/lib/domain/events";
import { AttendeeGender, EventItem } from "@/types";
import { formatDateIST, inr } from "@/utils";



import BackLink from "../BackLink";
import Confetti from "../Confetti";
import EventFactStrip from "../EventFactStrip";
import Loader from "../Loader";
import PhoneAuth, { AuthedCustomer } from "../PhoneAuth";
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
  whatsappSent: boolean;
  amount: number;
}

type PaymentIssueReason = "dismissed" | "verify_failed" | "network_error" | "script_load_failed";

const PAYMENT_ISSUE_COPY: Record<PaymentIssueReason, { title: string; body: string }> = {
  dismissed: {
    title: "Payment not completed",
    body: "You closed the payment window before finishing. Your seats were released — you can pick up right where you left off.",
  },
  verify_failed: {
    title: "We couldn't confirm your payment",
    body: "If any amount was deducted, it will be automatically refunded within a few working days. Your seats were released.",
  },
  network_error: {
    title: "Payment status unknown",
    body: "We couldn't reach the server to confirm your payment. If you were charged, don't pay again for the same seats — check My Bookings first.",
  },
  script_load_failed: {
    title: "Couldn't load the payment window",
    body: "Check your internet connection, then try again.",
  },
};

interface Props {
  event: EventItem;
  /** Null when the visitor hasn't signed in yet — seat selection is open to
   *  anyone; auth is only asked for at the "Proceed to checkout" step. */
  customer: { name: string; email: string | null; phone: string | null } | null;
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

/**
 * Resuming a booking in progress: a visitor who picks seats, wanders off to
 * another page (or just refreshes), then comes back shouldn't have to
 * reselect seats or retype attendee details. Mirrors the existing `holdId`
 * sessionStorage pattern (keyed per event) — restoring is purely a
 * client-side convenience; the actual seat lock is re-validated against the
 * server the moment they hit "Proceed to checkout" again (holdSeats already
 * prunes any seat someone else grabbed meanwhile).
 *
 * Only valid for SEAT_LOCK_TTL_MS (the same 8-minute window the server-side
 * seat lock itself lasts, see lib/db's lockSeats) — past that, the hold is
 * long gone and the selected seats may already belong to someone else, so
 * resuming would show a stale, misleading "still selected" state. `savedAt`
 * is stamped on every write and checked on every read; once it's past the
 * TTL the snapshot (and the now-pointless seat hold id) are dropped and the
 * visitor gets a fresh seat map instead.
 */
interface PersistedBookingState {
  savedAt?: number;
  selected?: string[];
  step?: "seats" | "attendees" | "summary";
  attendeeFirstNames?: Record<string, string>;
  attendeeLastNames?: Record<string, string>;
  attendeePhones?: Record<string, string>;
  attendeeEmails?: Record<string, string>;
  attendeeGenders?: Record<string, AttendeeGender | "">;
  appliedPromo?: { code: string; discount: number } | null;
}

function bookingStateKey(eventId: string): string {
  return `booking-state:${eventId}`;
}

function readPersistedBookingState(eventId: string): PersistedBookingState {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(bookingStateKey(eventId));
    if (!raw) return {};
    const parsed: PersistedBookingState = JSON.parse(raw);
    if (!parsed.savedAt || Date.now() - parsed.savedAt >= SEAT_LOCK_TTL_MS) {
      // Hold's definitely expired server-side by now — don't resurrect it.
      clearPersistedBooking(eventId);
      return {};
    }
    return parsed;
  } catch {
    return {};
  }
}

/** Called once a booking actually completes — resuming a *finished* booking
 *  makes no sense, and would otherwise resurrect stale seats/details the
 *  next time this visitor starts a fresh booking for the same event. */
function clearPersistedBooking(eventId: string) {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(bookingStateKey(eventId));
  sessionStorage.removeItem(`seat-hold:${eventId}`);
}

export default function BookingFlow({
  event,
  customer: initialCustomer,
  initialBookedSeats,
  initialLockedSeats,
}: Props) {
  // Updated in place once the checkout-time auth step succeeds (see
  // handleAuthSuccess) — everything below just reads `customer`.
  const [customer, setCustomer] = useState(initialCustomer);
  // Shown when an anonymous visitor clicks "Proceed to checkout".
  const [showAuthModal, setShowAuthModal] = useState(false);
  // One id per booking session, reused as the seat-lock key across the whole
  // anonymous-hold → sign-in → real-order lifecycle (see holdSeats/pay).
  // Mirrored into sessionStorage (keyed by event) so a reload mid-auth
  // doesn't orphan the hold under an id nothing remembers anymore.
  const [holdId] = useState<string>(() => {
    if (typeof window === "undefined") return ""; // SSR placeholder, unused
    const key = `seat-hold:${event.id}`;
    const existing = sessionStorage.getItem(key);
    if (existing) return existing;
    const fresh = crypto.randomUUID();
    sessionStorage.setItem(key, fresh);
    return fresh;
  });
  // Anchors the resumable-booking window to when this seat selection first
  // started, not to the last edit — otherwise typing attendee details would
  // keep sliding the 8-minute window forward past what the server-side seat
  // lock actually honors. Reused as-is on every persist write below. (A
  // lazy useState initializer, not useRef(Date.now()) — the latter would
  // evaluate Date.now() on every render, which React's purity rules forbid.)
  const [bookingSavedAt] = useState<number>(
    () => readPersistedBookingState(event.id).savedAt ?? Date.now()
  );
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(readPersistedBookingState(event.id).selected)
  );
  const [bookedSeats, setBookedSeats] = useState<Set<string>>(new Set(initialBookedSeats));
  const [lockedSeats, setLockedSeats] = useState<Set<string>>(new Set(initialLockedSeats));
  // seatId -> attendee first/last name; the first seat defaults to the
  // purchaser's own name (split best-effort on the first space). First name
  // is mandatory per seat, last name is optional.
  const [attendeeFirstNames, setAttendeeFirstNames] = useState<Record<string, string>>(
    () => readPersistedBookingState(event.id).attendeeFirstNames ?? {}
  );
  const [attendeeLastNames, setAttendeeLastNames] = useState<Record<string, string>>(
    () => readPersistedBookingState(event.id).attendeeLastNames ?? {}
  );
  // seatId -> optional extra contact details for that attendee
  const [attendeePhones, setAttendeePhones] = useState<Record<string, string>>(
    () => readPersistedBookingState(event.id).attendeePhones ?? {}
  );
  const [attendeeEmails, setAttendeeEmails] = useState<Record<string, string>>(
    () => readPersistedBookingState(event.id).attendeeEmails ?? {}
  );
  const [attendeeGenders, setAttendeeGenders] = useState<Record<string, AttendeeGender | "">>(
    () => readPersistedBookingState(event.id).attendeeGenders ?? {}
  );
  const [paying, setPaying] = useState(false);
  // True from the moment payment succeeds until the tickets are confirmed and
  // we've navigated / rendered them — drives the full-screen loader.
  const [finalizing, setFinalizing] = useState(false);
  const { showToast, toast } = useToast();
  const [confirmed, setConfirmed] = useState<Confirmation | null>(null);
  // Set the moment /api/orders succeeds so a later failure/retry always has
  // the order+token needed to explicitly free that hold (locks are keyed by
  // order id, not customer, so a stale hold from a failed attempt would
  // otherwise collide with the retry's new order for the same seats).
  const [lastOrder, setLastOrder] = useState<{ orderId: string; releaseToken: string } | null>(
    null
  );
  const [paymentIssue, setPaymentIssue] = useState<PaymentIssueReason | null>(null);
  // Guided checkout journey: pick seats → name attendees → review → pay.
  // Only trust a resumed later step if there are actually seats to go with
  // it — otherwise land back on "seats" rather than showing an empty review.
  const [step, setStep] = useState<"seats" | "attendees" | "summary">(() => {
    const persisted = readPersistedBookingState(event.id);
    return persisted.selected && persisted.selected.length > 0 ? (persisted.step ?? "seats") : "seats";
  });
  // Promo code applied on the summary step (server-validated preview).
  const [promoInput, setPromoInput] = useState("");
  const [applyingPromo, setApplyingPromo] = useState(false);
  const [appliedPromo, setAppliedPromo] = useState<{ code: string; discount: number } | null>(
    () => readPersistedBookingState(event.id).appliedPromo ?? null
  );
  const routeLoader = useRouteLoader();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Keep the resumable snapshot in sync so a visitor who wanders off to
  // another page (or refreshes) mid-booking comes back to exactly where
  // they left off, instead of re-picking seats and retyping every attendee.
  useEffect(() => {
    if (typeof window === "undefined" || confirmed) return;
    const data: PersistedBookingState = {
      savedAt: bookingSavedAt,
      selected: [...selected],
      step,
      attendeeFirstNames,
      attendeeLastNames,
      attendeePhones,
      attendeeEmails,
      attendeeGenders,
      appliedPromo,
    };
    try {
      sessionStorage.setItem(bookingStateKey(event.id), JSON.stringify(data));
    } catch {
      /* storage full/unavailable — resuming just won't work, not fatal */
    }
  }, [
    event.id,
    confirmed,
    bookingSavedAt,
    selected,
    step,
    attendeeFirstNames,
    attendeeLastNames,
    attendeePhones,
    attendeeEmails,
    attendeeGenders,
    appliedPromo,
  ]);

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

  // For the fact strip + the attendee step's per-seat tier label. Seats
  // someone else is mid-checkout on (locked) aren't actually bookable right
  // now either, even though they're not yet confirmed — the seat map itself
  // already disables them, so the headline count needs to agree with it.
  const totalSeatCount = useMemo(() => totalSeats(event), [event]);
  const remainingSeats = Math.max(0, totalSeatCount - bookedSeats.size - lockedSeats.size);
  const tierBySeatId = useMemo(() => {
    const map = new Map<string, string>();
    for (const seat of getSeatLayout(event)) map.set(seat.id, seat.tierName);
    return map;
  }, [event]);

  const totalAmount = useMemo(() => {
    let sum = 0;
    for (const id of selected) sum += seatPrice(event, id) ?? 0;
    return sum;
  }, [selected, event]);

  // What the customer actually pays after any applied promo (display only; the
  // server recomputes authoritatively in /api/orders).
  const payable = Math.max(0, totalAmount - (appliedPromo?.discount ?? 0));

  // Stable identity (functional setState, no `selected` closure) so it can be
  // passed through to <SeatMap>'s memoized seat buttons without invalidating
  // all ~thousands of them on every single toggle during a drag-select.
  const toggleSeat = useCallback(
    (seatId: string) => {
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
    },
    [showToast]
  );

  const splitName = (full: string) => {
    const parts = full.trim().split(/\s+/).filter(Boolean);
    return { first: parts[0] ?? "", last: parts.slice(1).join(" ") };
  };

  const firstNameForSeat = (seatId: string, index: number) =>
    attendeeFirstNames[seatId] ?? (index === 0 ? splitName(customer?.name ?? "").first : "");
  const lastNameForSeat = (seatId: string, index: number) =>
    attendeeLastNames[seatId] ?? (index === 0 ? splitName(customer?.name ?? "").last : "");
  const fullNameForSeat = (seatId: string, index: number) => {
    const first = firstNameForSeat(seatId, index).trim();
    const last = lastNameForSeat(seatId, index).trim();
    return last ? `${first} ${last}` : first;
  };

  // Reserve the selected seats anonymously so they can't be scooped by
  // someone else while this visitor completes the checkout-time auth step
  // (see holdId below) — /api/orders reuses this exact hold once signed in.
  const holdSeats = async (): Promise<boolean> => {
    try {
      const res = await fetch("/api/seats/hold", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: event.id, seatIds: selectedSeats, holdId }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error ?? "Some seats were just taken — please reselect", "error");
        if (data.conflicts) {
          setSelected((prev) => {
            const next = new Set(prev);
            for (const c of data.conflicts) next.delete(c);
            return next;
          });
        }
        refreshSeats();
        return false;
      }
      return true;
    } catch {
      showToast("Could not reach the server", "error");
      return false;
    }
  };

  const goToAttendees = async () => {
    if (selected.size === 0) return showToast("Select at least one seat to continue", "error");
    if (!customer) {
      if (!(await holdSeats())) return;
      setShowAuthModal(true);
      return;
    }
    setStep("attendees");
  };

  // Called once the checkout-time auth step succeeds (sign-in or new
  // account) — the seats are already held under `holdId`, so this just
  // records who's buying and continues straight into naming attendees.
  const handleAuthSuccess = (authed: AuthedCustomer) => {
    setCustomer({ name: authed.name, email: authed.email, phone: authed.phone });
    setShowAuthModal(false);
    setStep("attendees");
  };

  const goToSummary = () => {
    // Same rule the pay() call enforces — validate here so the summary is complete.
    const missing = selectedSeats.some(
      (seatId, i) => firstNameForSeat(seatId, i).trim().length < 2
    );
    if (missing) return showToast("Enter a first name (2+ characters) for every seat", "error");
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
      name: fullNameForSeat(seatId, i).trim(),
      phone: (attendeePhones[seatId] ?? "").trim(),
      email: (attendeeEmails[seatId] ?? "").trim(),
      gender: attendeeGenders[seatId] || undefined,
    }));
    const missing = attendees.find((a) => a.name.length < 2);
    if (missing) {
      return showToast(`Enter the attendee's first name for seat ${missing.seatId}`, "error");
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
          holdId,
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

      setLastOrder({ orderId: data.orderId, releaseToken: data.releaseToken });

      const ok = await loadRazorpay();
      if (!ok || !window.Razorpay) {
        await fetch("/api/release", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: data.orderId, releaseToken: data.releaseToken }),
        }).catch(() => {});
        setPaying(false);
        setPaymentIssue("script_load_failed");
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
        theme: { color: "#1d4ed8" },
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
              // Booking's done — nothing left to resume, and keeping this
              // around would resurrect these exact seats/details the next
              // time this visitor starts a fresh booking for the event.
              clearPersistedBooking(event.id);
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
                whatsappSent: verifyData.whatsappSent ?? false,
                amount: verifyData.amount,
              });
            } else {
              setFinalizing(false);
              setPaymentIssue("verify_failed");
              refreshSeats();
            }
          } catch {
            setFinalizing(false);
            setPaymentIssue("network_error");
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
            setPaymentIssue("dismissed");
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

  // Explicitly frees the previous attempt's hold before retrying — locks are
  // keyed by order id, so a still-live hold from the failed order would
  // otherwise collide with the new order this creates for the same seats.
  const releaseLastOrder = async () => {
    if (!lastOrder) return;
    await fetch("/api/release", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(lastOrder),
    }).catch(() => {});
  };

  const retryPayment = async () => {
    setPaymentIssue(null);
    await releaseLastOrder();
    await refreshSeats();
    pay();
  };

  const abandonAndReselect = async () => {
    setPaymentIssue(null);
    await releaseLastOrder();
    await refreshSeats();
    setStep("seats");
  };

  // ---------- Confirmation: one QR ticket per attendee ----------

  if (confirmed) {
    return (
      <div className="max-w-lg mx-auto py-8">
        <Confetti />

        {/* Success banner — soft green celebratory panel */}
        <div className="relative overflow-hidden rounded-3xl border border-emerald-100 bg-linear-to-b from-emerald-50 via-emerald-50/70 to-white px-6 py-10 text-center mb-6 shadow-[0_16px_40px_rgba(16,185,129,0.12)]">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -top-12 -right-12 w-44 h-44 rounded-full bg-emerald-200/40 blur-3xl"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-12 -left-12 w-44 h-44 rounded-full bg-emerald-200/30 blur-3xl"
          />
          <div className="relative">
            <div className="tick-pop w-20 h-20 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto mb-5 shadow-[0_12px_30px_rgba(16,185,129,0.35)]">
              <Check className="w-10 h-10" strokeWidth={3} aria-hidden="true" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mb-2">
              Booking confirmed!
            </h1>
            <p className="text-slate-700 text-sm">
              {confirmed.tickets.length > 1
                ? `${confirmed.tickets.length} tickets — each attendee shows their own QR at the gate.`
                : "Show this QR at the venue gate."}
            </p>
            <p className="text-slate-500 text-sm mt-1">
              {confirmed.whatsappSent && confirmed.emailSent
                ? `Tickets were sent to your WhatsApp and emailed to ${customer?.email}.`
                : confirmed.whatsappSent
                  ? "Tickets were sent to your WhatsApp."
                  : confirmed.emailSent
                    ? `Tickets were emailed to ${customer?.email}.`
                    : "Save your tickets — they're also in My Tickets in your account."}
            </p>
          </div>
        </div>

        <div className="space-y-4 text-left">
          {confirmed.tickets.map((t) => (
            <div
              key={t.ticketId}
              className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center gap-5 shadow-[0_8px_24px_rgba(15,23,42,0.06)]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={t.qrDataUrl}
                alt={`Ticket QR ${t.ticketId}`}
                className="w-28 h-28 rounded-lg bg-white p-1 shrink-0 border border-slate-100"
              />
              <div className="min-w-0">
                <p className="font-bold wrap-break-word">{t.name}</p>
                <p className="text-sm text-slate-600">Seat {t.seatId}</p>
                <p className="font-mono text-xs text-slate-500 mt-1 wrap-break-word">
                  {t.ticketId}
                </p>
                <Link
                  href={`/ticket/${t.ticketId}`}
                  className="inline-block mt-2 text-sm text-[#1d4ed8] hover:underline"
                >
                  View / share ticket
                </Link>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 mt-4 text-left space-y-2 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
          <Row label="Booking ID" value={confirmed.bookingId} mono />
          <Row label="Event" value={event.title} />
          <Row label="When" value={formatDateIST(event.startsAt)} />
          <Row label="Amount paid" value={inr(confirmed.amount)} strong />
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mt-6">
          <Link
            href="/account/tickets"
            className="flex-1 text-center bg-slate-100 hover:bg-slate-200 rounded-full px-5 py-3 font-semibold text-sm transition-colors"
          >
            My tickets
          </Link>
          <Link
            href="/"
            className="flex-1 text-center bg-linear-to-r from-[#D4AF37] to-[#E6C35C] hover:brightness-105 text-[#081A3A] rounded-full px-5 py-3 font-semibold text-sm transition-all"
          >
            Browse more events
          </Link>
        </div>
      </div>
    );
  }

  // ---------- Payment pending / failed — retry with the same seats ----------

  if (paymentIssue) {
    const copy = PAYMENT_ISSUE_COPY[paymentIssue];
    const severe = paymentIssue !== "dismissed";
    return (
      <div className="max-w-lg mx-auto text-center py-12">
        <div
          className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5 ${
            severe ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"
          }`}
        >
          <AlertTriangle className="w-8 h-8" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-bold mb-2">{copy.title}</h1>
        <p className="text-slate-600 text-sm mb-8">{copy.body}</p>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 text-left mb-6">
          <p className="font-semibold wrap-break-word">{event.title}</p>
          <p className="text-xs text-slate-500 mb-3">
            {event.venue} · {formatDateIST(event.startsAt)}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {selectedSeats.map((seatId) => (
              <span
                key={seatId}
                className="text-[11px] font-mono font-semibold tracking-wide text-[#1d4ed8] bg-[#1d4ed8]/10 border border-[#1d4ed8]/25 rounded-lg px-2.5 py-1"
              >
                {seatId}
              </span>
            ))}
          </div>
          <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-200 text-sm">
            <span className="text-slate-600">Total payable</span>
            <span className="font-bold">{inr(payable)}</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={abandonAndReselect}
            className="flex-1 rounded-full border border-slate-300 px-5 py-3 font-semibold text-sm text-slate-700 hover:text-slate-900 hover:border-slate-400 transition-colors"
          >
            Choose different seats
          </button>
          <button
            onClick={retryPayment}
            disabled={paying}
            className="flex-1 bg-linear-to-r from-[#D4AF37] to-[#E6C35C] hover:brightness-105 text-[#081A3A] disabled:opacity-40 disabled:cursor-not-allowed rounded-full px-5 py-3 font-semibold text-sm transition-all"
          >
            {paying ? "Processing…" : `Retry payment · ${inr(payable)}`}
          </button>
        </div>

        {paymentIssue === "network_error" && (
          <p className="text-xs text-slate-500 mt-4">
            Not sure if you were charged?{" "}
            <Link href="/account/bookings" className="text-[#1d4ed8] hover:underline">
              Check My Bookings
            </Link>{" "}
            first.
          </p>
        )}
        {toast}
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

      {/* Event header — the same banner + at-a-glance facts as the event page,
          so the customer keeps full context while booking. */}
      <div
        className={`relative rounded-2xl overflow-hidden aspect-video mb-5 bg-linear-to-br ${event.poster}`}
      >
        {(event.imageUrl || event.gallery[0]) && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={event.imageUrl || event.gallery[0]}
            alt={event.title}
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
        <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/25 to-transparent" />
        <div className="absolute bottom-0 p-4 sm:p-5 text-white">
          <h1 className="text-xl sm:text-2xl font-bold drop-shadow wrap-break-word">
            {event.title}
          </h1>
          <p className="text-xs sm:text-sm text-white/85 mt-1 drop-shadow">
            {formatDateIST(event.startsAt)} · {event.venue}, {event.city}
          </p>
        </div>
      </div>

      <EventFactStrip event={event} remaining={remainingSeats} />

      {customer && (
        <p className="text-xs text-slate-500 mt-4 mb-6">
          Booking as <span className="text-slate-700">{customer.name}</span> (
          {customer.email ?? customer.phone}).
        </p>
      )}

      <Stepper current={step} />

      {/* ---- Step 1: choose seats ---- */}
      {step === "seats" && (
        <div className="mt-6 pb-28">
          <div className="rounded-2xl bg-linear-to-b from-slate-900 to-slate-950 border border-slate-800 p-4 sm:p-6 shadow-[0_16px_40px_rgba(15,23,42,0.18)]">
            <SeatMap
              event={event}
              bookedSeats={bookedSeats}
              lockedSeats={lockedSeats}
              selected={selected}
              onToggle={toggleSeat}
            />
          </div>
          {/* `pb-28` above keeps the last seat rows from hiding behind the
              fixed bar's height + safe-area inset on notched phones. */}
          <FixedActionBar obstruction>
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
                <p className="text-xs text-slate-500 truncate">{selectedSeats.join(", ")}</p>
              )}
            </div>
            <button
              onClick={goToAttendees}
              disabled={selected.size === 0}
              className="bg-linear-to-r from-[#D4AF37] to-[#E6C35C] hover:brightness-105 text-[#081A3A] disabled:opacity-40 disabled:cursor-not-allowed rounded-full px-6 py-2.5 font-semibold text-sm transition-all sm:shrink-0"
            >
              Proceed to checkout
            </button>
          </FixedActionBar>
        </div>
      )}

      {/* ---- Step 2: attendee names ---- */}
      {step === "attendees" && (
        <div className="mt-6 max-w-3xl pb-28">
          <div className="flex items-start gap-3 rounded-xl bg-[#eff4ff] border border-[#1d4ed8]/15 px-4 py-3 mb-5">
            <Users className="w-4.5 h-4.5 shrink-0 text-[#1d4ed8] mt-0.5" aria-hidden="true" />
            <p className="text-sm text-slate-700">
              <span className="font-semibold">Add a name for every seat.</span>{" "}
              {selectedSeats.length > 1
                ? "Each attendee gets their own scannable QR ticket at the gate."
                : "Your attendee will get a scannable QR ticket at the gate."}
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            {selectedSeats.map((seatId, i) => (
              <div
                key={seatId}
                className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3"
              >
                <span className="shrink-0 flex items-center justify-center whitespace-nowrap text-[11px] font-mono font-semibold tracking-wide text-[#1d4ed8] bg-[#1d4ed8]/10 border border-[#1d4ed8]/25 rounded-lg px-2.5 py-1.5 mt-0.5">
                  {seatId}
                </span>
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] uppercase tracking-widest text-slate-400 truncate">
                      {tierBySeatId.get(seatId) ?? "Seat"}
                    </span>
                    <span className="shrink-0 text-xs font-semibold text-slate-600">
                      {inr(seatPrice(event, seatId) ?? 0)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={firstNameForSeat(seatId, i)}
                      onChange={(e) =>
                        setAttendeeFirstNames((prev) => ({ ...prev, [seatId]: e.target.value }))
                      }
                      placeholder="First name"
                      required
                      minLength={2}
                      maxLength={80}
                      className="h-9 w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 text-sm outline-none focus:border-[#1d4ed8] focus:bg-white transition-colors"
                    />
                    <input
                      value={lastNameForSeat(seatId, i)}
                      onChange={(e) =>
                        setAttendeeLastNames((prev) => ({ ...prev, [seatId]: e.target.value }))
                      }
                      placeholder="Last name (optional)"
                      maxLength={80}
                      className="h-9 w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 text-sm outline-none focus:border-[#1d4ed8] focus:bg-white transition-colors"
                    />
                  </div>
                  <input
                    type="tel"
                    value={attendeePhones[seatId] ?? ""}
                    onChange={(e) =>
                      setAttendeePhones((prev) => ({ ...prev, [seatId]: e.target.value }))
                    }
                    placeholder="Phone number (optional)"
                    className="h-9 w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 text-sm outline-none focus:border-[#1d4ed8] focus:bg-white transition-colors"
                  />
                  <input
                    type="email"
                    value={attendeeEmails[seatId] ?? ""}
                    onChange={(e) =>
                      setAttendeeEmails((prev) => ({ ...prev, [seatId]: e.target.value }))
                    }
                    placeholder="Email address (optional)"
                    className="h-9 w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 text-sm outline-none focus:border-[#1d4ed8] focus:bg-white transition-colors"
                  />
                  <select
                    value={attendeeGenders[seatId] ?? ""}
                    onChange={(e) =>
                      setAttendeeGenders((prev) => ({
                        ...prev,
                        [seatId]: e.target.value as AttendeeGender | "",
                      }))
                    }
                    className="h-9 w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 text-sm outline-none focus:border-[#1d4ed8] focus:bg-white transition-colors text-slate-700"
                  >
                    <option value="">Gender (optional)</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="boy">Boy</option>
                    <option value="girl">Girl</option>
                    <option value="others">Others</option>
                  </select>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-start gap-3 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 mt-4">
            <AlertTriangle
              className="w-4.5 h-4.5 shrink-0 text-amber-700 mt-0.5"
              aria-hidden="true"
            />
            <p className="text-sm text-amber-800">
              Please carry a valid Government-issued ID proof for verification at the venue.
            </p>
          </div>

          <div className="flex items-center justify-between mt-4 px-1 text-sm text-slate-600">
            <span>
              {selected.size} seat{selected.size > 1 ? "s" : ""} selected
            </span>
            <span className="font-semibold text-slate-900">{inr(totalAmount)}</span>
          </div>

          <FixedActionBar>
            <button
              onClick={() => {
                clearPromo(); // seats may change → any previewed discount is stale
                setStep("seats");
              }}
              className="rounded-full border border-slate-300 px-5 py-2.5 font-semibold text-sm text-slate-700 hover:text-slate-900 hover:border-slate-400 transition-colors"
            >
              Back
            </button>
            <button
              onClick={goToSummary}
              className="flex-1 bg-linear-to-r from-[#D4AF37] to-[#E6C35C] hover:brightness-105 text-[#081A3A] rounded-full px-6 py-2.5 font-semibold text-sm transition-all"
            >
              Continue
            </button>
          </FixedActionBar>
        </div>
      )}

      {/* ---- Step 3: review & pay ---- */}
      {step === "summary" && (
        <div className="mt-6 max-w-2xl pb-28">
          <div className="flex items-start gap-3 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 mb-4">
            <AlertTriangle
              className="w-4.5 h-4.5 shrink-0 text-amber-700 mt-0.5"
              aria-hidden="true"
            />
            <p className="text-sm text-amber-800">
              Please verify your seat selection and attendee details before proceeding with payment.
              Changes may not be possible after booking confirmation.
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200">
              <p className="font-semibold">{event.title}</p>
              <p className="text-sm text-slate-600">
                {event.venue} · {formatDateIST(event.startsAt)}
              </p>
            </div>
            <ul className="divide-y divide-slate-200">
              {selectedSeats.map((seatId, i) => (
                <li key={seatId} className="flex items-center gap-3 px-5 py-3">
                  <span className="shrink-0 whitespace-nowrap text-[11px] font-mono font-semibold tracking-wide text-[#1d4ed8] bg-[#1d4ed8]/10 border border-[#1d4ed8]/25 rounded-lg px-2.5 py-1">
                    {seatId}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {fullNameForSeat(seatId, i)}
                  </span>
                  <span className="shrink-0 text-sm text-slate-600">
                    {inr(seatPrice(event, seatId) ?? 0)}
                  </span>
                </li>
              ))}
            </ul>
            <div className="px-5 py-4 border-t border-slate-200 space-y-1.5">
              <div className="flex items-center justify-between text-sm text-slate-600">
                <span>
                  Subtotal · {selected.size} seat{selected.size > 1 ? "s" : ""}
                </span>
                <span>{inr(totalAmount)}</span>
              </div>
              {appliedPromo && (
                <div className="flex items-center justify-between text-sm text-emerald-700">
                  <span>Promo {appliedPromo.code}</span>
                  <span>−{inr(appliedPromo.discount)}</span>
                </div>
              )}
              <div className="flex items-center justify-between pt-1.5 border-t border-slate-200">
                <span className="text-sm text-slate-700">Total payable</span>
                <span className="text-lg font-bold">{inr(payable)}</span>
              </div>
            </div>
          </div>

          {/* Promo code */}
          <div className="mt-4">
            {appliedPromo ? (
              <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-50 px-4 py-3">
                <Tag className="w-4 h-4 shrink-0 text-emerald-700" aria-hidden="true" />
                <span className="text-sm">
                  <span className="font-semibold">{appliedPromo.code}</span> applied — you save{" "}
                  {inr(appliedPromo.discount)}
                </span>
                <button
                  onClick={clearPromo}
                  disabled={paying}
                  className="ml-auto text-sm text-slate-600 hover:text-slate-800 disabled:opacity-40"
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
                  className="flex-1 min-w-0 bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-sm font-mono tracking-wide uppercase outline-none focus:border-[#1d4ed8]"
                />
                <button
                  onClick={applyPromo}
                  disabled={applyingPromo || !promoInput.trim()}
                  className="shrink-0 rounded-full border border-slate-300 px-5 py-2.5 font-semibold text-sm text-slate-800 hover:border-slate-400 disabled:opacity-40 transition-colors"
                >
                  {applyingPromo ? "Applying…" : "Apply"}
                </button>
              </div>
            )}
          </div>

          <p className="text-xs text-slate-500 mt-4">
            Your seats are held for 8 minutes once you proceed to payment.
          </p>

          <FixedActionBar>
            <button
              onClick={() => setStep("attendees")}
              disabled={paying}
              className="rounded-full border border-slate-300 px-5 py-2.5 font-semibold text-sm text-slate-700 hover:text-slate-900 hover:border-slate-400 disabled:opacity-40 transition-colors"
            >
              Back
            </button>
            <button
              onClick={pay}
              disabled={paying || selected.size === 0}
              className="flex-1 bg-linear-to-r from-[#D4AF37] to-[#E6C35C] hover:brightness-105 text-[#081A3A] disabled:opacity-40 disabled:cursor-not-allowed rounded-full px-6 py-2.5 font-semibold text-sm transition-all"
            >
              {paying ? "Processing…" : `Proceed to payment · ${inr(payable)}`}
            </button>
          </FixedActionBar>
        </div>
      )}
      {showAuthModal &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
          >
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-[fade-in_.15s_ease-out]" />
            <div className="relative w-full max-w-sm bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl animate-[dialog-in_.15s_ease-out]">
              <button
                onClick={() => setShowAuthModal(false)}
                aria-label="Close"
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 text-xl leading-none"
              >
                ×
              </button>
              <h2 className="font-bold text-lg mb-1">Sign in to continue</h2>
              <p className="text-sm text-slate-500 mb-5">
                Your seats are held — sign in or create an account to finish booking.
              </p>
              <PhoneAuth onSuccess={handleAuthSuccess} />
            </div>
          </div>,
          document.body
        )}
      {toast}
    </div>
  );
}

/**
 * A persistent, full-width fixed bottom bar for a step's primary action —
 * used on all three booking steps so the CTA never requires scrolling to
 * reach, on both web and mweb. Content is constrained to the same max-w-6xl
 * column as the rest of the page so it stays aligned on wide screens; the
 * bar itself spans the full viewport width edge to edge.
 */
function FixedActionBar({
  children,
  obstruction,
}: {
  children: React.ReactNode;
  /** Marks this bar for SeatMap's arrow-position math (see SeatMap.component.tsx) — only the seats step needs it, since SeatMap only renders then. */
  obstruction?: boolean;
}) {
  return (
    <div
      data-seatmap-obstruction={obstruction ? true : undefined}
      className="fixed inset-x-0 bottom-0 z-20 bg-white border-t border-slate-200 shadow-[0_-8px_24px_rgba(15,23,42,0.08)]"
    >
      <div className="max-w-6xl mx-auto px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        {children}
      </div>
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
    <ol className="flex mt-5 items-center gap-2 sm:gap-3">
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
                    ? "bg-[#1d4ed8] text-[#ffffff]"
                    : active
                      ? "bg-[#1d4ed8]/20 text-[#1d4ed8] ring-1 ring-[#1d4ed8]"
                      : "bg-slate-100 text-slate-500"
                }`}
              >
                {done ? <Check className="w-3.5 h-3.5" aria-hidden="true" /> : i + 1}
              </span>
              <span
                className={`text-sm font-medium ${active ? "text-slate-900" : "text-slate-500"}`}
              >
                {s.label}
              </span>
            </span>
            {i < STEPS.length - 1 && (
              <span className="w-4 sm:w-8 h-px bg-slate-200 shrink-0" aria-hidden="true" />
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
      <span className="text-slate-500">{label}</span>
      <span
        className={`${mono ? "font-mono" : ""} ${strong ? "font-bold text-base" : ""} text-right wrap-break-word min-w-0`}
      >
        {value}
      </span>
    </div>
  );
}