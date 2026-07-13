export interface Movie {
  id: string;
  title: string;
  genre: string[];
  language: string;
  rating: number;
  durationMins: number;
  certificate: string;
  poster: string; // gradient token used for the poster card
  synopsis: string;
}

export interface Theatre {
  id: string;
  name: string;
  area: string;
}

export interface Show {
  id: string;
  movieId: string;
  theatreId: string;
  time: string; // "HH:mm"
  date: string; // "YYYY-MM-DD"
  priceTiers: Record<SeatTier, number>; // paise
}

export type SeatTier = "SILVER" | "GOLD" | "RECLINER";

export interface Seat {
  id: string; // e.g. "G-A12"
  row: string;
  number: number;
  tier: SeatTier;
}

export type SeatState = "available" | "locked" | "booked";

export interface Booking {
  bookingId: string;
  showId: string;
  seatIds: string[];
  amount: number; // paise
  razorpayOrderId: string;
  razorpayPaymentId?: string;
  status: "PENDING" | "CONFIRMED" | "FAILED";
  customerEmail: string;
  createdAt: number;
  ticketId?: string; // set once on confirmation, stable across verify replays
  emailSent?: boolean;
}
