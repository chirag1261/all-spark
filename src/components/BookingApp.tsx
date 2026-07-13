"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MOVIES, THEATRES, getShows, todayISO, MAX_SEATS_PER_BOOKING } from "@/lib/data";
import { Movie, Show } from "@/lib/types";
import SeatMap from "./SeatMap";

type View =
  | { name: "home" }
  | { name: "movie"; movie: Movie }
  | { name: "seats"; movie: Movie; show: Show }
  | {
      name: "confirmed";
      movie: Movie;
      show: Show;
      bookingId: string;
      seats: string[];
      amount: number;
    };

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

const inr = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN")}`;

export default function BookingApp() {
  const [view, setView] = useState<View>({ name: "home" });
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bookedSeats, setBookedSeats] = useState<Set<string>>(new Set());
  const [lockedSeats, setLockedSeats] = useState<Set<string>>(new Set());
  const [email, setEmail] = useState("");
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshSeats = useCallback(async (showId: string) => {
    try {
      const res = await fetch(`/api/seats?showId=${encodeURIComponent(showId)}`);
      if (!res.ok) return;
      const data = await res.json();
      setBookedSeats(new Set(data.booked));
      setLockedSeats(new Set(data.locked));
    } catch {
      /* transient network error — keep last known state */
    }
  }, []);

  // Poll seat availability while on the seat map so other users' locks show up.
  useEffect(() => {
    if (view.name !== "seats") return;
    refreshSeats(view.show.id);
    pollRef.current = setInterval(() => refreshSeats(view.show.id), 5000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [view, refreshSeats]);

  const filteredMovies = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return MOVIES;
    return MOVIES.filter(
      (m) =>
        m.title.toLowerCase().includes(q) ||
        m.language.toLowerCase().includes(q) ||
        m.genre.some((g) => g.toLowerCase().includes(q))
    );
  }, [query]);

  const totalAmount = useMemo(() => {
    if (view.name !== "seats") return 0;
    let sum = 0;
    for (const id of selected) {
      const row = id[0];
      const tier = row <= "B" ? "RECLINER" : row <= "F" ? "GOLD" : "SILVER";
      sum += view.show.priceTiers[tier];
    }
    return sum;
  }, [selected, view]);

  const toggleSeat = (seatId: string) => {
    setError(null);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(seatId)) {
        next.delete(seatId);
      } else {
        if (next.size >= MAX_SEATS_PER_BOOKING) {
          setError(`You can book at most ${MAX_SEATS_PER_BOOKING} seats`);
          return prev;
        }
        next.add(seatId);
      }
      return next;
    });
  };

  const openSeatMap = (movie: Movie, show: Show) => {
    setSelected(new Set());
    setError(null);
    setView({ name: "seats", movie, show });
  };

  const pay = async () => {
    if (view.name !== "seats" || paying) return;
    setError(null);

    if (selected.size === 0) return setError("Select at least one seat");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError("Enter a valid email");

    setPaying(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ showId: view.show.id, seatIds: [...selected], email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPaying(false);
        if (res.status === 409 && data.conflicts) {
          setError(`Seats just taken by someone else: ${data.conflicts.join(", ")}`);
          setSelected((prev) => {
            const next = new Set(prev);
            for (const c of data.conflicts) next.delete(c);
            return next;
          });
          refreshSeats(view.show.id);
        } else {
          setError(data.error ?? "Could not start payment");
        }
        return;
      }

      const ok = await loadRazorpay();
      if (!ok || !window.Razorpay) {
        await fetch("/api/release", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: data.orderId }),
        }).catch(() => {});
        setError("Could not load the payment window. Check your connection and retry.");
        setPaying(false);
        return;
      }

      const movie = view.movie;
      const show = view.show;

      const rzp = new window.Razorpay({
        key: data.keyId,
        amount: data.amount,
        currency: data.currency,
        name: "BookMyShow Clone",
        description: `${movie.title} · ${show.time} · Seats ${[...selected].join(", ")}`,
        order_id: data.orderId,
        prefill: { email },
        theme: { color: "#f84464" },
        handler: async (resp: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          try {
            const verifyRes = await fetch("/api/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(resp),
            });
            const verifyData = await verifyRes.json();
            if (verifyRes.ok && verifyData.status === "CONFIRMED") {
              setView({
                name: "confirmed",
                movie,
                show,
                bookingId: verifyData.bookingId,
                seats: verifyData.seats,
                amount: verifyData.amount,
              });
            } else {
              setError(verifyData.error ?? "Payment verification failed. If money was deducted it will be auto-refunded.");
              refreshSeats(show.id);
            }
          } catch {
            setError("Could not verify payment — check My Bookings before retrying.");
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
              body: JSON.stringify({ orderId: data.orderId }),
            }).catch(() => {});
            setPaying(false);
            refreshSeats(show.id);
          },
        },
      });
      rzp.open();
      // paying stays true until handler/ondismiss resolves
    } catch {
      setError("Something went wrong. Please try again.");
      setPaying(false);
    }
  };

  // ---------- Views ----------

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-zinc-950/90 backdrop-blur border-b border-zinc-800">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center gap-4">
          <button
            onClick={() => setView({ name: "home" })}
            className="text-xl font-extrabold tracking-tight shrink-0"
          >
            book<span className="text-[#f84464]">my</span>show
            <span className="ml-1.5 text-[10px] font-semibold uppercase text-zinc-500 align-super">
              clone
            </span>
          </button>
          {view.name === "home" && (
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search movies, genres, languages…"
              className="flex-1 max-w-md bg-zinc-900 border border-zinc-800 rounded-lg px-3.5 py-2 text-sm outline-none focus:border-[#f84464]"
            />
          )}
          <span className="ml-auto text-xs text-zinc-500 hidden sm:block">Bengaluru</span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {view.name === "home" && (
          <>
            <h1 className="text-2xl font-bold mb-6">Movies in Bengaluru</h1>
            {filteredMovies.length === 0 ? (
              <p className="text-zinc-500">No movies match “{query}”.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
                {filteredMovies.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setView({ name: "movie", movie: m })}
                    className="text-left group"
                  >
                    <div
                      className={`aspect-[2/3] rounded-xl bg-gradient-to-br ${m.poster} p-4 flex flex-col justify-end shadow-lg group-hover:scale-[1.02] transition-transform`}
                    >
                      <span className="text-lg font-bold leading-tight drop-shadow">{m.title}</span>
                      <span className="text-xs text-white/70 mt-1">
                        ★ {m.rating}/10 · {m.certificate}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-zinc-400">
                      {m.language} · {m.genre.join(", ")}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {view.name === "movie" && (
          <MovieDetail
            movie={view.movie}
            onBack={() => setView({ name: "home" })}
            onSelectShow={(show) => openSeatMap(view.movie, show)}
          />
        )}

        {view.name === "seats" && (
          <div>
            <button
              onClick={() => setView({ name: "movie", movie: view.movie })}
              className="text-sm text-zinc-400 hover:text-zinc-200 mb-4"
            >
              ← Back to showtimes
            </button>
            <div className="flex flex-wrap items-baseline gap-x-3 mb-1">
              <h1 className="text-xl font-bold">{view.movie.title}</h1>
              <span className="text-sm text-zinc-400">
                {THEATRES.find((t) => t.id === view.show.theatreId)?.name} · today {view.show.time}
              </span>
            </div>
            <p className="text-xs text-zinc-500 mb-6">
              Seats are held for 8 minutes once you proceed to pay.
            </p>

            <SeatMap
              bookedSeats={bookedSeats}
              lockedSeats={lockedSeats}
              selected={selected}
              onToggle={toggleSeat}
              prices={view.show.priceTiers}
            />

            {/* Checkout bar */}
            <div className="sticky bottom-0 mt-6 bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
              <div className="flex-1">
                <p className="text-sm font-medium">
                  {selected.size > 0 ? (
                    <>
                      {selected.size} seat{selected.size > 1 ? "s" : ""} · {[...selected].join(", ")}
                    </>
                  ) : (
                    "Select your seats"
                  )}
                </p>
                {error && <p className="text-sm text-red-400 mt-1">{error}</p>}
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#f84464] sm:w-56"
              />
              <button
                onClick={pay}
                disabled={paying || selected.size === 0}
                className="bg-[#f84464] hover:bg-[#e03a58] disabled:opacity-40 disabled:cursor-not-allowed rounded-lg px-6 py-2.5 font-semibold text-sm transition-colors"
              >
                {paying ? "Processing…" : selected.size > 0 ? `Pay ${inr(totalAmount)}` : "Pay"}
              </button>
            </div>
          </div>
        )}

        {view.name === "confirmed" && (
          <div className="max-w-md mx-auto text-center py-12">
            <div className="w-16 h-16 rounded-full bg-emerald-500/15 text-emerald-400 text-3xl flex items-center justify-center mx-auto mb-5">
              ✓
            </div>
            <h1 className="text-2xl font-bold mb-1">Booking confirmed!</h1>
            <p className="text-zinc-400 text-sm mb-8">A confirmation was sent to your email.</p>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-left space-y-3">
              <Row label="Booking ID" value={view.bookingId} mono />
              <Row label="Movie" value={view.movie.title} />
              <Row
                label="Theatre"
                value={THEATRES.find((t) => t.id === view.show.theatreId)?.name ?? ""}
              />
              <Row label="Show" value={`Today, ${view.show.time}`} />
              <Row label="Seats" value={view.seats.join(", ")} />
              <div className="border-t border-zinc-800 pt-3">
                <Row label="Amount paid" value={inr(view.amount)} strong />
              </div>
            </div>
            <button
              onClick={() => setView({ name: "home" })}
              className="mt-8 text-sm text-[#f84464] hover:underline"
            >
              Book another movie →
            </button>
          </div>
        )}
      </main>
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
      <span className={`${mono ? "font-mono" : ""} ${strong ? "font-bold text-base" : ""} text-right`}>
        {value}
      </span>
    </div>
  );
}

function MovieDetail({
  movie,
  onBack,
  onSelectShow,
}: {
  movie: Movie;
  onBack: () => void;
  onSelectShow: (show: Show) => void;
}) {
  const shows = getShows(movie.id, todayISO());
  const byTheatre = new Map<string, Show[]>();
  for (const s of shows) {
    if (!byTheatre.has(s.theatreId)) byTheatre.set(s.theatreId, []);
    byTheatre.get(s.theatreId)!.push(s);
  }
  const now = new Date();
  const hasStarted = (s: Show) => new Date(`${s.date}T${s.time}:00`) < now;

  return (
    <div>
      <button onClick={onBack} className="text-sm text-zinc-400 hover:text-zinc-200 mb-4">
        ← All movies
      </button>
      <div className="flex flex-col sm:flex-row gap-6 mb-10">
        <div
          className={`w-40 shrink-0 aspect-[2/3] rounded-xl bg-gradient-to-br ${movie.poster} p-3 flex items-end`}
        >
          <span className="font-bold leading-tight drop-shadow">{movie.title}</span>
        </div>
        <div>
          <h1 className="text-3xl font-bold mb-2">{movie.title}</h1>
          <p className="text-sm text-zinc-400 mb-3">
            ★ {movie.rating}/10 · {movie.certificate} · {Math.floor(movie.durationMins / 60)}h{" "}
            {movie.durationMins % 60}m · {movie.language} · {movie.genre.join(", ")}
          </p>
          <p className="text-zinc-300 max-w-xl">{movie.synopsis}</p>
        </div>
      </div>

      <h2 className="text-lg font-semibold mb-4">Showtimes · Today</h2>
      <div className="space-y-4">
        {THEATRES.map((t) => (
          <div key={t.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <p className="font-medium mb-0.5">{t.name}</p>
            <p className="text-xs text-zinc-500 mb-3">{t.area}</p>
            <div className="flex flex-wrap gap-2">
              {(byTheatre.get(t.id) ?? []).map((s) => {
                const started = hasStarted(s);
                return (
                  <button
                    key={s.id}
                    disabled={started}
                    onClick={() => onSelectShow(s)}
                    className={[
                      "px-4 py-2 rounded-lg border text-sm font-medium transition-colors",
                      started
                        ? "border-zinc-800 text-zinc-700 cursor-not-allowed line-through"
                        : "border-emerald-800 text-emerald-400 hover:bg-emerald-950",
                    ].join(" ")}
                  >
                    {s.time}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
