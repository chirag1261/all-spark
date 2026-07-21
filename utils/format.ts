import { BookingStatus } from "@/types";

/** Formats paise as an Indian-rupee string, e.g. 49900 → "₹499". */
export const inr = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN")}`;

/** Formats an ISO timestamp in IST, e.g. "Sat, 5 Jul 2025, 7:00 pm". */
export const formatDateIST = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });

/** Human-readable copy for a booking status — never show the raw enum to a customer. */
export const BOOKING_STATUS_LABEL: Record<BookingStatus, string> = {
  CONFIRMED: "Paid",
  PENDING: "Pending",
  FAILED: "Not completed",
  REFUNDED: "Refunded",
};

export const BOOKING_STATUS_TONE: Record<BookingStatus, string> = {
  CONFIRMED: "bg-emerald-500/15 text-emerald-400",
  PENDING: "bg-amber-500/15 text-amber-400",
  FAILED: "bg-zinc-500/15 text-zinc-400",
  REFUNDED: "bg-sky-500/15 text-sky-400",
};
