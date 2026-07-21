import { HeartHandshake, type LucideIcon, Music, Sparkles } from "lucide-react";

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
      <section className="max-w-6xl mx-auto px-4 py-20 grid lg:grid-cols-2 gap-12 items-center">
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/utsav/audience.jpg"
            alt="Devotees gathered in celebration"
            className="rounded-3xl w-full aspect-4/3 object-cover border border-[#2a2450] shadow-[0_24px_60px_rgba(0,0,0,0.5)]"
          />
          <div className="absolute inset-0 rounded-3xl ring-1 ring-inset ring-[#f5a524]/10" />
        </div>
        <div>
          <p className="font-heading text-[#f5a524] text-lg mb-2">About Utsav Events</p>
          <h2 className="font-heading text-3xl sm:text-5xl font-semibold leading-tight mb-5">
            Sacred experiences in music &amp; devotion
          </h2>
          <p className="text-zinc-300/90 leading-relaxed text-lg">
            Utsav Events is a Bangalore-based cultural organisation dedicated to bringing
            communities together through the timeless power of music and devotion. We curate sacred
            experiences that honour tradition, uplift the spirit, and create lasting memories for
            every devotee who walks through our doors.
          </p>
        </div>
      </section>

      {/* Why Attend */}
      <section className="border-y border-white/6 bg-[#171228]/40">
        <div className="max-w-6xl mx-auto px-4 py-20">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <p className="font-heading text-[#f5a524] text-lg mb-1">Why Attend</p>
            <h2 className="font-heading text-3xl sm:text-5xl font-semibold">
              An experience that touches the soul
            </h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-6">
            {WHY.map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className="text-center bg-[#0d0a1f]/60 border border-[#2a2450] rounded-3xl p-8 hover:border-[#f5a524]/40 hover:-translate-y-1 transition-all duration-300"
                >
                  <div className="w-14 h-14 rounded-full bg-[#f5a524]/10 text-[#f5a524] flex items-center justify-center mx-auto mb-5">
                    <Icon className="w-6 h-6" aria-hidden="true" />
                  </div>
                  <h3 className="font-heading text-2xl font-semibold mb-2">{f.title}</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">{f.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="relative overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/utsav/artist.jpg"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-[#0d0a1f]/85" />
        <div className="relative max-w-3xl mx-auto px-4 py-24 text-center">
          <h2 className="font-heading text-3xl sm:text-5xl font-semibold mb-4">
            Be part of a divine evening
          </h2>
          <p className="text-zinc-300 text-lg leading-relaxed">
            Seats are limited. Reserve yours today and join a gathering of hearts united in
            devotion.
          </p>
        </div>
      </section>
    </>
  );
}
