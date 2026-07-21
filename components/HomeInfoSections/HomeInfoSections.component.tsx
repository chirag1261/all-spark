import {
  Armchair,
  ArrowRight,
  type LucideIcon,
  RefreshCcw,
  ShieldCheck,
  Ticket,
} from "lucide-react";

/**
 * Static, informative marketing sections for the public homepage: a "why book
 * with us" trust strip and a "how it works" walkthrough. Purely presentational
 * — no data dependencies — so they render on both the featured-event and plain
 * event-list variants of the landing page.
 */

const TRUST: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: ShieldCheck,
    title: "Secure payments",
    body: "Every payment runs through Razorpay with bank-grade encryption. We never see your card details.",
  },
  {
    icon: Ticket,
    title: "Individual QR tickets",
    body: "Each attendee gets their own scannable QR ticket — no confusion at the gate, no sharing one code.",
  },
  {
    icon: Armchair,
    title: "Pick your exact seat",
    body: "See the full seat map and choose where you sit. What you select is what you get.",
  },
  {
    icon: RefreshCcw,
    title: "Easy refunds",
    body: "Plans change. Cancellations are refunded to your original payment method within 5–7 working days.",
  },
];

const STEPS = [
  { n: 1, title: "Discover", body: "Browse concerts, comedy nights and live events near you." },
  {
    n: 2,
    title: "Pick your seats",
    body: "Open the seat map and select a seat for each attendee.",
  },
  {
    n: 3,
    title: "Pay securely",
    body: "Check out in seconds with Razorpay — UPI, cards or netbanking.",
  },
  {
    n: 4,
    title: "Show your QR",
    body: "Get an instant QR ticket by email and on-screen. Flash it at the gate.",
  },
];

export default function HomeInfoSections() {
  return (
    <>
      {/* Why book with us */}
      <section className="max-w-6xl mx-auto px-4 py-16">
        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-2 flex items-center gap-3">
          <span className="w-8 h-1 rounded-full bg-linear-to-r from-[#f84464] to-[#ff2e63] inline-block" />
          Why book with Utsav Events
        </h2>
        <p className="text-zinc-400 mb-8 max-w-2xl">
          Thousands of fans trust us to get them through the gate — here&apos;s what you can count
          on.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {TRUST.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="bg-[#16181d] border border-[#24272e] rounded-2xl p-6 hover:border-[#f84464]/40 hover:-translate-y-1 transition-all duration-300"
              >
                <div className="w-11 h-11 rounded-xl bg-[#f84464]/10 text-[#f84464] flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5" aria-hidden="true" />
                </div>
                <h3 className="font-bold mb-1.5">{f.title}</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">{f.body}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-white/6 bg-[#16181d]/40">
        <div className="max-w-6xl mx-auto px-4 py-16">
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-2 flex items-center gap-3">
            <span className="w-8 h-1 rounded-full bg-linear-to-r from-[#f84464] to-[#ff2e63] inline-block" />
            How it works
          </h2>
          <p className="text-zinc-400 mb-8 max-w-2xl">
            From browsing to the gate in four easy steps.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {STEPS.map((s, i) => (
              <div
                key={s.n}
                className="relative bg-[#0d0f12] border border-[#24272e] rounded-2xl p-6"
              >
                <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-linear-to-r from-[#f84464] to-[#ff2e63] text-white font-bold text-sm mb-4">
                  {s.n}
                </span>
                <h3 className="font-bold mb-1.5">{s.title}</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">{s.body}</p>
                {i < STEPS.length - 1 && (
                  <ArrowRight
                    className="hidden lg:block absolute top-9 -right-2.5 w-5 h-5 text-zinc-700"
                    aria-hidden="true"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
