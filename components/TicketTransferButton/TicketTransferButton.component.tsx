"use client";

import { useEffect, useState } from "react";

import { UserCog, X } from "lucide-react";
import { createPortal } from "react-dom";

import { useToast } from "../Toast";

interface TicketInfo {
  ticketId: string;
  seatId: string;
  attendeeName: string;
}

/**
 * Admin action: rename the attendee on an already-issued ticket to transfer
 * ownership, instead of cancelling and rebooking. The ticket id and QR
 * signature never change — only the name stored against that ticket does —
 * so the same booking ID and QR code (already emailed/shared) keep working.
 */
export default function TicketTransferButton({ bookingId }: { bookingId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tickets, setTickets] = useState<TicketInfo[] | null>(null);
  const { showToast, toast } = useToast();

  const openDialog = async () => {
    setOpen(true);
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/tickets?bookingId=${encodeURIComponent(bookingId)}`);
      const data = await res.json();
      if (res.ok) {
        setTickets(data.tickets);
      } else {
        showToast(data.error ?? "Could not load tickets", "error");
        setOpen(false);
      }
    } catch {
      showToast("Could not reach the server", "error");
      setOpen(false);
    } finally {
      setLoading(false);
    }
  };

  const renameTicket = async (ticketId: string, name: string) => {
    const res = await fetch("/api/admin/tickets/rename", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticketId, name }),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error ?? "Rename failed", "error");
      return false;
    }
    setTickets((prev) =>
      prev ? prev.map((t) => (t.ticketId === ticketId ? { ...t, attendeeName: name } : t)) : prev
    );
    showToast("Ticket renamed — same booking ID and QR still work");
    return true;
  };

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className="inline-flex items-center gap-1 text-sm text-[#1d4ed8] hover:underline"
      >
        <UserCog className="w-3.5 h-3.5" aria-hidden="true" />
        Transfer
      </button>
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <TransferDialog
            loading={loading}
            tickets={tickets}
            onClose={() => setOpen(false)}
            onRename={renameTicket}
          />,
          document.body
        )}
      {toast}
    </>
  );
}

function TransferDialog({
  loading,
  tickets,
  onClose,
  onRename,
}: {
  loading: boolean;
  tickets: TicketInfo[] | null;
  onClose: () => void;
  onRename: (ticketId: string, name: string) => Promise<boolean>;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm cursor-default animate-[fade-in_.15s_ease-out]"
      />
      <div className="relative w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl animate-[dialog-in_.15s_ease-out]">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-lg">Transfer ticket ownership</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-slate-500 hover:text-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-sm text-slate-600 mb-4">
          Rename the attendee on a seat&apos;s ticket without cancelling it — the booking ID and QR
          code stay exactly the same.
        </p>
        {loading ? (
          <p className="text-sm text-slate-500 text-center py-6">Loading tickets…</p>
        ) : !tickets || tickets.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-6">No tickets found for this booking.</p>
        ) : (
          <ul className="space-y-3 max-h-80 overflow-y-auto">
            {tickets.map((t) => (
              <TicketRow key={t.ticketId} ticket={t} onRename={onRename} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function TicketRow({
  ticket,
  onRename,
}: {
  ticket: TicketInfo;
  onRename: (ticketId: string, name: string) => Promise<boolean>;
}) {
  const [name, setName] = useState(ticket.attendeeName);
  const [busy, setBusy] = useState(false);
  const dirty = name.trim().length >= 2 && name.trim() !== ticket.attendeeName;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dirty || busy) return;
    setBusy(true);
    await onRename(ticket.ticketId, name.trim());
    setBusy(false);
  };

  return (
    <li className="border border-slate-200 rounded-xl p-3">
      <form onSubmit={submit} className="flex items-center gap-2">
        <span className="shrink-0 text-xs font-mono font-semibold text-[#1d4ed8] bg-[#1d4ed8]/10 rounded px-2 py-1">
          {ticket.seatId}
        </span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          minLength={2}
          maxLength={80}
          className="min-w-0 flex-1 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm outline-none focus:border-[#1d4ed8]"
        />
        <button
          type="submit"
          disabled={!dirty || busy}
          className="shrink-0 bg-[#1d4ed8] hover:bg-[#1e40af] text-white disabled:opacity-40 disabled:cursor-not-allowed rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors"
        >
          {busy ? "Saving…" : "Save"}
        </button>
      </form>
    </li>
  );
}
