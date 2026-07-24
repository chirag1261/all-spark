import { HeartHandshake, type LucideIcon, ShieldCheck, Sparkles, Users2 } from "lucide-react";
import Link from "next/link";

import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import { getFeaturedEvent } from "@/lib/db";

const VALUES: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: ShieldCheck,
    title: "Authenticity",
    body: "Presenting devotional music rooted in tradition, with integrity and reverence for its origins.",
  },
  {
    icon: HeartHandshake,
    title: "Community",
    body: "Creating inclusive gathering spaces where diverse audiences come together in shared devotion.",
  },
  {
    icon: Sparkles,
    title: "Excellence",
    body: "Meticulous curation of every production element — sound, staging, atmosphere and hospitality.",
  },
  {
    icon: Users2,
    title: "Accessibility",
    body: "Ensuring the beauty of devotional music reaches all people, across generations and backgrounds.",
  },
];

const TEAM = [
  {
    title: "Founder & Director",
    body: "Sets the vision — the artistic direction and the devotional spirit behind every gathering.",
  },
  {
    title: "Events & Production",
    body: "Brings each evening to life, from venue and sound to the smallest detail of the experience.",
  },
  {
    title: "Community & Outreach",
    body: "Connects with devotees and audiences, growing the community around each celebration.",
  },
];

const STATS = [
  { value: "2026", label: "Founded" },
  { value: "Rudrotsav", label: "First event" },
  { value: "1500+", label: "Attendees invited" },
];

/** Public About page — the story, mission and values of Utsav Events. */
export async function AboutScreen() {
  const featured = await getFeaturedEvent();
  const ctaHref = featured ? `/events/${featured.id}` : "/events";

  return (
    <div className="min-h-screen text-slate-900">
      <SiteHeader />

      <main>
        {/* Hero */}
        <section className="section-y border-b border-slate-200">
          <div className="max-w-4xl mx-auto px-4 text-center">
            <p className="font-heading text-[#1d4ed8] text-lg mb-3">About Utsav Events</p>
            <h1 className="font-heading text-4xl sm:text-6xl font-semibold leading-tight">
              Born from devotion. Built on community.
              <br className="hidden sm:block" /> Dedicated to the divine.
            </h1>
          </div>
        </section>

        {/* Story */}
        <section className="section-y">
          <div className="max-w-3xl mx-auto px-4 space-y-5 text-lg leading-relaxed text-slate-700/90">
            <p>
              Utsav Events was founded in 2026 by a group of music enthusiasts and spiritual seekers
              in Bangalore, united by a simple belief: devotional music deserves to be presented with
              the highest quality and care.
            </p>
            <p>
              We see a bhajan performance not as mere entertainment, but as a communal spiritual
              experience — an evening where a gathering of hearts is drawn together in the spirit of
              bhakti, and where every note becomes a shared prayer.
            </p>
          </div>
        </section>

        {/* Who we are — image + intro */}
        <section className="section-y border-y border-slate-200 bg-[#f5f8ff]">
          <div className="max-w-6xl mx-auto px-4 grid lg:grid-cols-2 gap-12 items-center">
            <div className="relative order-2 lg:order-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://res.cloudinary.com/cih7cika/image/upload/f_auto,q_auto,w_1600/utsav-events/audience"
                alt="Devotees gathered in celebration"
                className="rounded-3xl w-full aspect-4/3 object-cover border border-[#e5eaf1] shadow-[0_16px_40px_rgba(15,23,42,0.10)]"
              />
              <div className="absolute inset-0 rounded-3xl ring-1 ring-inset ring-[#1d4ed8]/10" />
            </div>
            <div className="order-1 lg:order-2">
              <p className="font-heading text-[#1d4ed8] text-lg mb-2">Who We Are</p>
              <h2 className="font-heading text-3xl sm:text-5xl font-semibold leading-tight mb-5">
                About Utsav Events
              </h2>
              <p className="text-slate-700/90 leading-relaxed text-lg">
                Utsav Events is a Bangalore-based cultural organisation dedicated to bringing
                communities together through the timeless power of music and devotion. We curate
                sacred experiences that honour tradition, uplift the spirit, and create lasting
                memories for every devotee who walks through our doors.
              </p>
              <p className="font-heading text-xl text-[#1d4ed8]/90 mt-5">
                Where Music Meets the Divine
              </p>
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="border-y border-slate-200 bg-[#f5f8ff]">
          <div className="max-w-4xl mx-auto px-4 py-10 grid grid-cols-3 gap-6 text-center">
            {STATS.map((s) => (
              <div key={s.label}>
                <p className="font-heading text-3xl sm:text-5xl font-semibold text-[#1d4ed8]">
                  {s.value}
                </p>
                <p className="text-xs sm:text-sm uppercase tracking-widest text-slate-500 mt-1">
                  {s.label}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Mission */}
        <section className="section-y">
          <div className="max-w-3xl mx-auto px-4 text-center">
            <p className="font-heading text-[#1d4ed8] text-lg mb-3">Our mission</p>
            <blockquote className="font-heading text-2xl sm:text-4xl font-semibold leading-snug">
              “To preserve and celebrate India&apos;s rich tradition of devotional music by creating
              extraordinary live experiences that bring communities together in the spirit of
              bhakti.”
            </blockquote>
          </div>
        </section>

        {/* Values */}
        <section className="border-y border-slate-200 bg-[#f5f8ff]">
          <div className="section-y max-w-6xl mx-auto px-4">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <p className="font-heading text-[#1d4ed8] text-lg mb-1">What we stand for</p>
              <h2 className="font-heading text-3xl sm:text-5xl font-semibold">Our values</h2>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {VALUES.map((v) => {
                const Icon = v.icon;
                return (
                  <div
                    key={v.title}
                    className="bg-white border border-[#e5eaf1] rounded-3xl p-6 hover:border-[#1d4ed8]/40 hover:-translate-y-1 transition-all duration-300"
                  >
                    <div className="w-12 h-12 rounded-full bg-[#1d4ed8]/10 text-[#1d4ed8] flex items-center justify-center mb-4">
                      <Icon className="w-5 h-5" aria-hidden="true" />
                    </div>
                    <h3 className="font-heading text-xl font-semibold mb-1.5">{v.title}</h3>
                    <p className="text-sm text-slate-600 leading-relaxed">{v.body}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Team */}
        <section className="section-y">
          <div className="max-w-6xl mx-auto px-4">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <p className="font-heading text-[#1d4ed8] text-lg mb-1">The people behind it</p>
              <h2 className="font-heading text-3xl sm:text-5xl font-semibold">Our team</h2>
            </div>
            <div className="grid sm:grid-cols-3 gap-5">
              {TEAM.map((t) => (
                <div
                  key={t.title}
                  className="text-center bg-white border border-[#e5eaf1] rounded-3xl p-8"
                >
                  <h3 className="font-heading text-2xl font-semibold mb-2">{t.title}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{t.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Closing CTA */}
        <section className="border-t border-slate-200 bg-[#f5f8ff]">
          <div className="section-y max-w-3xl mx-auto px-4 text-center">
            <h2 className="font-heading text-3xl sm:text-5xl font-semibold mb-4">
              Join us at our next gathering
            </h2>
            <p className="text-slate-700 text-lg leading-relaxed mb-8">
              {featured
                ? `${featured.title} — ${featured.venue}, ${featured.city}. Reserve your seat and be part of a divine evening.`
                : "New celebrations are announced often. Reserve your seat and be part of a divine evening."}
            </p>
            <Link
              href={ctaHref}
              className="inline-block bg-linear-to-r from-[#1d4ed8] to-[#3b82f6] hover:brightness-110 text-white font-semibold rounded-full px-8 py-3 transition-all"
            >
              {featured ? "View the event" : "Browse events"}
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
