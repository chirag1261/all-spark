import { CalendarDays, type LucideIcon, MapPin, Ticket, Users } from "lucide-react";

import { minPrice, totalPhysicalSeats } from "@/lib/domain/events";
import { EventItem } from "@/types";
import { formatDateIST, inr } from "@/utils";

interface Props {
  event: EventItem;
  remaining: number;
}

/**
 * The "When / Where / Availability / Tickets from" colored fact-card row —
 * shared across the landing page, event detail page and the booking flow so
 * the same at-a-glance event context follows the customer everywhere.
 */
export default function EventFactStrip({ event, remaining }: Props) {
  // The full venue capacity, not the sellable-only count — a blocked seat is
  // still a seat that exists, just one `remaining` already accounts for.
  const total = totalPhysicalSeats(event);
  const soldOut = remaining <= 0;
  const fromPrice = minPrice(event);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 items-stretch">
      <Fact icon={CalendarDays} tone="cobalt" label="When" value={formatDateIST(event.startsAt)} />
      <Fact icon={MapPin} tone="violet" label="Where" value={`${event.venue}, ${event.city}`} />
      <Fact
        icon={Users}
        tone={soldOut ? "rose" : "emerald"}
        label="Availability"
        value={soldOut ? "Sold out" : `${remaining} of ${total} left`}
      />
      <Fact icon={Ticket} tone="amber" label="Tickets from" value={inr(fromPrice)} />
    </div>
  );
}

type FactTone = "cobalt" | "violet" | "emerald" | "amber" | "rose";

const FACT_TONES: Record<FactTone, { card: string; icon: string }> = {
  cobalt: { card: "bg-[#eff4ff] border-[#1d4ed8]/15", icon: "bg-[#1d4ed8]/12 text-[#1d4ed8]" },
  violet: { card: "bg-violet-50 border-violet-200", icon: "bg-violet-100 text-violet-700" },
  emerald: { card: "bg-emerald-50 border-emerald-200", icon: "bg-emerald-100 text-emerald-700" },
  amber: { card: "bg-amber-50 border-amber-200", icon: "bg-amber-100 text-amber-700" },
  rose: { card: "bg-rose-50 border-rose-200", icon: "bg-rose-100 text-rose-700" },
};

function Fact({
  icon: Icon,
  tone,
  label,
  value,
}: {
  icon: LucideIcon;
  tone: FactTone;
  label: string;
  value: string;
}) {
  const t = FACT_TONES[tone];
  return (
    <div
      className={`h-full flex items-start gap-3 rounded-2xl border p-4 shadow-[0_8px_24px_rgba(15,23,42,0.06)] transition-transform duration-300 hover:-translate-y-0.5 ${t.card}`}
    >
      <span className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${t.icon}`}>
        <Icon className="w-4.5 h-4.5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-widest text-slate-500 mb-0.5">{label}</p>
        <p className="text-sm font-bold text-slate-900 wrap-break-word leading-snug">{value}</p>
      </div>
    </div>
  );
}
