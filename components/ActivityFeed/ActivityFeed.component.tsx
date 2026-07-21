import {
  Ban,
  Banknote,
  CalendarPlus,
  Circle,
  type LucideIcon,
  Pencil,
  Trash2,
  UserCog,
  UserMinus,
  UserPlus,
} from "lucide-react";
import Link from "next/link";

import { AuditEntry } from "@/types";
import { formatDateIST } from "@/utils";

/**
 * Turns developer-style audit actions (e.g. "booking.refund") into a plain-language
 * label + icon a non-technical admin can scan, and links each entry to the page
 * where that entity is managed.
 */
const ACTION_META: Record<string, { icon: LucideIcon; label: string }> = {
  "event.create": { icon: CalendarPlus, label: "Event created" },
  "event.update": { icon: Pencil, label: "Event updated" },
  "event.delete": { icon: Trash2, label: "Event deleted" },
  "booking.refund": { icon: Banknote, label: "Refund issued" },
  "booking.cancel": { icon: Ban, label: "Booking cancelled" },
  "user.create": { icon: UserPlus, label: "Admin added" },
  "user.update": { icon: UserCog, label: "Admin updated" },
  "user.delete": { icon: UserMinus, label: "Admin removed" },
};

/** Where clicking an entry takes the admin, based on the entity it touched. */
function hrefFor(entry: AuditEntry): string | null {
  switch (entry.entity) {
    case "event":
      return `/admin/bookings?eventId=${encodeURIComponent(entry.entityId)}`;
    case "booking":
      return "/admin/bookings";
    case "user":
      return "/admin/users";
    default:
      return null;
  }
}

export default function ActivityFeed({ entries }: { entries: AuditEntry[] }) {
  return (
    <div className="border border-zinc-800 rounded-xl divide-y divide-zinc-800/60">
      {entries.map((entry) => {
        const meta = ACTION_META[entry.action] ?? { icon: Circle, label: entry.action };
        const Icon = meta.icon;
        const href = hrefFor(entry);
        const body = (
          <div className="px-4 py-3 flex items-baseline gap-3 text-sm hover:bg-zinc-900/50 transition-colors">
            <Icon className="w-4 h-4 shrink-0 text-zinc-400 translate-y-0.5" aria-hidden="true" />
            <span className="min-w-0 wrap-break-word">
              <span className="font-semibold text-zinc-100">{meta.label}:</span>{" "}
              <span className="text-zinc-400">{entry.detail}</span>
            </span>
            <span className="ml-auto text-xs text-zinc-500 whitespace-nowrap">
              {formatDateIST(new Date(entry.at).toISOString())}
            </span>
          </div>
        );
        return href ? (
          <Link key={entry.id} href={href} className="block">
            {body}
          </Link>
        ) : (
          <div key={entry.id}>{body}</div>
        );
      })}
    </div>
  );
}
