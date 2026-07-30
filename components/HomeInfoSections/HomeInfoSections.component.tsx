import { HeartHandshake, type LucideIcon, Music, Sparkles } from "lucide-react";

import Parallax from "@/components/Parallax";
import Reveal from "@/components/Reveal";
import RevealText from "@/components/RevealText";

/**
 * Devotional marketing sections for the public homepage, mirroring
 * utsavevents.live: an "About Utsav Events" intro, a "Why Attend" trio, and a
 * closing call-to-action. Purely presentational — renders on both the
 * featured-event and plain event-list variants of the landing page.
 */

const WHY: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: Music,
    title: "A Master of Devotion",
    body: "Voices that carry decades of bhakti tradition — each bhajan a prayer, each note a blessing that resonates long after the evening ends.",
  },
  {
    icon: HeartHandshake,
    title: "A Sacred Gathering",
    body: "Join thousands of devotees in a shared moment of spiritual connection. Not just a concert — a community coming together in reverence and joy.",
  },
  {
    icon: Sparkles,
    title: "An Unforgettable Evening",
    body: "From the fragrance of flowers to the warmth of diyas, every detail is crafted to transport you into a world of divine celebration.",
  },
];

export default function HomeInfoSections() {
  return (
    <>
      {/* About Utsav Events */}
      <section className="section-y max-w-6xl mx-auto px-4 grid lg:grid-cols-2 gap-12 items-center">
        <Reveal variant="left" className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://res.cloudinary.com/cih7cika/image/upload/f_auto,q_auto,w_1600/utsav-events/audience"
            alt="Devotees gathered in celebration"
            className="rounded-3xl w-full aspect-4/3 object-cover border border-[#e5eaf1] shadow-[0_16px_40px_rgba(15,23,42,0.10)]"
          />
          <div className="absolute inset-0 rounded-3xl ring-1 ring-inset ring-[#1d4ed8]/10" />
        </Reveal>
        <Reveal variant="right">
          <p className="font-heading text-[#1d4ed8] text-lg mb-2">About Utsav Events</p>
          <h2 className="font-heading text-3xl sm:text-5xl font-semibold leading-tight mb-5">
            <RevealText as="span">Sacred experiences in music &amp; devotion</RevealText>
          </h2>
          <p className="text-slate-700/90 leading-relaxed text-lg">
            Utsav Events is a Bangalore-based cultural organisation dedicated to bringing
            communities together through the timeless power of music and devotion. We curate sacred
            experiences that honour tradition, uplift the spirit, and create lasting memories for
            every devotee who walks through our doors.
          </p>
        </Reveal>
      </section>

      {/* Why Attend */}
      <section className="border-y border-slate-200 bg-[#f5f8ff]">
        <div className="section-y max-w-6xl mx-auto px-4">
          <Reveal className="text-center max-w-2xl mx-auto mb-12">
            <p className="font-heading text-[#1d4ed8] text-lg mb-1">Why Attend</p>
            <h2 className="font-heading text-3xl sm:text-5xl font-semibold">
              <RevealText as="span">An experience that touches the soul</RevealText>
            </h2>
          </Reveal>
          <div className="grid sm:grid-cols-3 gap-6">
            {WHY.map((f, i) => {
              const Icon = f.icon;
              return (
                <Reveal
                  key={f.title}
                  delay={i * 90}
                  className="text-center bg-white border border-[#e5eaf1] rounded-3xl p-8 hover:border-[#1d4ed8]/40 hover:-translate-y-1 transition-all duration-300"
                >
                  <div className="w-14 h-14 rounded-full bg-[#1d4ed8]/10 text-[#1d4ed8] flex items-center justify-center mx-auto mb-5">
                    <Icon className="w-6 h-6" aria-hidden="true" />
                  </div>
                  <h3 className="font-heading text-2xl font-semibold mb-2">{f.title}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{f.body}</p>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="relative overflow-hidden">
        <Parallax speed={0.12} max={32} className="absolute -inset-y-12 inset-x-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://res.cloudinary.com/cih7cika/image/upload/f_auto,q_auto,w_1600/utsav-events/artist"
            alt=""
            aria-hidden="true"
            className="w-full h-full object-cover"
          />
        </Parallax>
        <div className="absolute inset-0 bg-[#0d0a1f]/85" />
        <Reveal variant="scale" className="section-y relative max-w-3xl mx-auto px-4 text-center text-white">
          <h2 className="font-heading text-3xl sm:text-5xl font-semibold mb-4">
            <RevealText as="span">Be part of a divine evening</RevealText>
          </h2>
          <p className="text-white/80 text-lg leading-relaxed">
            Seats are limited. Reserve yours today and join a gathering of hearts united in
            devotion.
          </p>
        </Reveal>
      </section>
    </>
  );
}
