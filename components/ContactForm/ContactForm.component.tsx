"use client";

import { useState } from "react";

import { ArrowRight } from "lucide-react";

import { useToast } from "../Toast";

const TOPICS = [
  "General enquiry",
  "Booking or refund",
  "Event registration — Rudrotsav",
  "Partnership / press",
  "Something else",
];

const inputCls =
  "w-full bg-[#0d0a1f] border border-[#2a2450] rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#d99a45] transition-colors";
const labelCls = "block text-xs uppercase tracking-widest text-zinc-500 mb-1.5";

/** Public "send us a message" form → POST /api/contact. */
export default function ContactForm() {
  const { showToast, toast } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [topic, setTopic] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) return showToast("Please enter your name", "error");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return showToast("Please enter a valid email", "error");
    }
    if (message.trim().length < 5) return showToast("Please enter a message", "error");

    setBusy(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone, topic, message }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error ?? "Could not send your message", "error");
        setBusy(false);
        return;
      }
      setSent(true);
    } catch {
      showToast("Could not reach the server", "error");
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div className="bg-[#171228] border border-[#2a2450] rounded-3xl p-8 text-center">
        <h2 className="font-heading text-2xl font-semibold mb-2">Thank you!</h2>
        <p className="text-zinc-400">
          Your message is on its way — we usually reply within 24 hours.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-[#171228] border border-[#2a2450] rounded-3xl p-6 sm:p-8">
      <h2 className="font-heading text-2xl font-semibold mb-1">Send Us a Message</h2>
      <p className="text-sm text-zinc-500 mb-6">
        Fill in the form and we will get back to you within 24 hours.
      </p>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>
              Full name <span className="text-[#d99a45]">*</span>
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
              required
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>
              Email <span className="text-[#d99a45]">*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Your email address"
              required
              className={inputCls}
            />
          </div>
        </div>
        <div>
          <label className={labelCls}>Phone</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Your phone number (optional)"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>
            What is this about? <span className="text-[#d99a45]">*</span>
          </label>
          <select
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            required
            className={inputCls}
          >
            <option value="" disabled>
              Select a topic…
            </option>
            {TOPICS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>
            Message <span className="text-[#d99a45]">*</span>
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Tell us more — how can we help?"
            rows={5}
            required
            className={inputCls}
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="w-full inline-flex items-center justify-center gap-2 bg-linear-to-r from-[#d99a45] to-[#e8bd6b] hover:brightness-110 disabled:opacity-40 text-white font-semibold rounded-full px-6 py-3 shadow-lg shadow-[#d99a45]/25 transition-all"
        >
          {busy ? "Sending…" : "Send Message"}
          {!busy && <ArrowRight className="w-4 h-4" aria-hidden="true" />}
        </button>
      </form>
      {toast}
    </div>
  );
}
