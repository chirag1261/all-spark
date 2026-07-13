import { Movie, Seat, SeatTier, Show, Theatre } from "./types";

export const MOVIES: Movie[] = [
  {
    id: "m1",
    title: "Interstellar: Re-Release",
    genre: ["Sci-Fi", "Drama"],
    language: "English",
    rating: 8.7,
    durationMins: 169,
    certificate: "UA",
    poster: "from-indigo-600 via-purple-700 to-slate-900",
    synopsis:
      "A team of explorers travel through a wormhole in space in an attempt to ensure humanity's survival.",
  },
  {
    id: "m2",
    title: "Kalki 2898 AD",
    genre: ["Action", "Sci-Fi"],
    language: "Telugu",
    rating: 8.2,
    durationMins: 181,
    certificate: "UA",
    poster: "from-amber-500 via-orange-700 to-stone-900",
    synopsis:
      "A modern-day avatar of Vishnu descends to protect the world from dark forces in a dystopian future.",
  },
  {
    id: "m3",
    title: "Jawan",
    genre: ["Action", "Thriller"],
    language: "Hindi",
    rating: 7.8,
    durationMins: 169,
    certificate: "UA",
    poster: "from-red-600 via-rose-800 to-zinc-900",
    synopsis:
      "A man driven by a personal vendetta rectifies the wrongs in society, crossing paths with a ruthless outlaw.",
  },
  {
    id: "m4",
    title: "Oppenheimer",
    genre: ["Biography", "Drama"],
    language: "English",
    rating: 8.4,
    durationMins: 180,
    certificate: "A",
    poster: "from-orange-400 via-red-900 to-black",
    synopsis:
      "The story of American scientist J. Robert Oppenheimer and his role in the development of the atomic bomb.",
  },
  {
    id: "m5",
    title: "Manjummel Boys",
    genre: ["Survival", "Thriller"],
    language: "Malayalam",
    rating: 8.3,
    durationMins: 135,
    certificate: "UA",
    poster: "from-emerald-600 via-teal-800 to-slate-900",
    synopsis:
      "A group of friends from Manjummel get trapped in the Guna caves and fight against all odds to survive.",
  },
  {
    id: "m6",
    title: "Dune: Part Two",
    genre: ["Sci-Fi", "Adventure"],
    language: "English",
    rating: 8.6,
    durationMins: 166,
    certificate: "UA",
    poster: "from-yellow-600 via-amber-800 to-stone-950",
    synopsis:
      "Paul Atreides unites with Chani and the Fremen while seeking revenge against the conspirators who destroyed his family.",
  },
];

export const THEATRES: Theatre[] = [
  { id: "t1", name: "PVR: Phoenix Marketcity", area: "Whitefield" },
  { id: "t2", name: "INOX: Garuda Mall", area: "MG Road" },
  { id: "t3", name: "Cinepolis: Nexus Mall", area: "Koramangala" },
];

const SHOW_TIMES = ["10:15", "13:30", "16:45", "20:00", "23:15"];

// Deterministic show list: every movie plays in every theatre at every time slot, today.
export function getShows(movieId: string, date: string): Show[] {
  const shows: Show[] = [];
  for (const theatre of THEATRES) {
    for (const time of SHOW_TIMES) {
      shows.push({
        id: `s-${movieId}-${theatre.id}-${time.replace(":", "")}`,
        movieId,
        theatreId: theatre.id,
        time,
        date,
        priceTiers: {
          SILVER: 18000, // ₹180 in paise
          GOLD: 28000, // ₹280
          RECLINER: 55000, // ₹550
        },
      });
    }
  }
  return shows;
}

export function getShowById(showId: string, date: string): Show | undefined {
  const parts = showId.split("-");
  if (parts.length !== 4) return undefined;
  const movieId = parts[1];
  return getShows(movieId, date).find((s) => s.id === showId);
}

// 10 rows: A-B recliner, C-F gold, G-J silver. 14 seats per row with an aisle gap handled in UI.
const ROWS: Array<{ row: string; tier: SeatTier }> = [
  { row: "A", tier: "RECLINER" },
  { row: "B", tier: "RECLINER" },
  { row: "C", tier: "GOLD" },
  { row: "D", tier: "GOLD" },
  { row: "E", tier: "GOLD" },
  { row: "F", tier: "GOLD" },
  { row: "G", tier: "SILVER" },
  { row: "H", tier: "SILVER" },
  { row: "I", tier: "SILVER" },
  { row: "J", tier: "SILVER" },
];

export const SEATS_PER_ROW = 14;
export const MAX_SEATS_PER_BOOKING = 10;

export function getSeatLayout(): Seat[] {
  const seats: Seat[] = [];
  for (const { row, tier } of ROWS) {
    for (let n = 1; n <= SEATS_PER_ROW; n++) {
      seats.push({ id: `${row}${n}`, row, number: n, tier });
    }
  }
  return seats;
}

const VALID_SEAT_IDS = new Set(getSeatLayout().map((s) => s.id));

export function isValidSeatId(seatId: string): boolean {
  return VALID_SEAT_IDS.has(seatId);
}

export function getSeatTier(seatId: string): SeatTier | undefined {
  return getSeatLayout().find((s) => s.id === seatId)?.tier;
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
