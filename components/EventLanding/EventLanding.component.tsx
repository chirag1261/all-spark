import Link from "next/link";

import { minPrice, registrationState, ticketTiers, totalSeats } from "@/lib/domain/events";
import { EventItem } from "@/types";
import { formatDateIST, inr } from "@/utils";

import BookMyShowLink from "../BookMyShowLink";
import CountdownTimer from "../CountdownTimer";
import HeroMedia from "../HeroMedia";

interface Props {
  event: EventItem;
  remaining: number;
}

/**
 * Rich landing page for the featured event — hero, highlights, photo gallery,
 * ticket pricing, FAQs and a booking CTA. Fully admin-controlled: title,
 * tagline, banner, gallery, categories, FAQs and dates all come from the
 * event record.
 */
export default function EventLanding({ event, remaining }: Props) {
  const reg = registrationState(event);
  const soldOut = remaining <= 0;
  const bookable = reg === "open" && !soldOut;
  const total = totalSeats(event);
  const fromPrice = minPrice(event);
  const tiers = ticketTiers(event);

  const cta = bookable ? (
    <Link
      href={`/events/${event.id}/book`}
      className="inline-block w-full sm:w-auto text-center bg-linear-to-r from-[#d99a45] to-[#e8bd6b] hover:brightness-110 hover:scale-[1.02] rounded-2xl px-9 py-4 font-bold text-base transition-all shadow-[0_10px_40px_rgba(217,154,69,0.4)]"
    >
      Book tickets · from {inr(fromPrice)}
    </Link>
  ) : (
    <span className="inline-block w-full sm:w-auto text-center bg-zinc-800 text-zinc-400 rounded-xl px-8 py-4 font-bold text-base cursor-not-allowed">
      {soldOut
        ? "Sold out"
        : reg === "upcoming"
          ? `Bookings open ${formatDateIST(event.registrationOpensAt)}`
          : "Bookings closed"}
    </span>
  );

  return (
    <div>
      {/* ---- Hero: auto-playing media canvas ---- */}
      <section
        className={`relative min-h-[78vh] flex items-end overflow-hidden bg-linear-to-br ${event.poster}`}
      >
        <HeroMedia
          images={[...new Set([event.imageUrl, ...event.gallery].filter(Boolean))]}
          alt={event.title}
        />
        <div className="absolute inset-0 bg-linear-to-t from-[#0d0a1f] via-[#0d0a1f]/55 to-[#0d0a1f]/10" />
        <div className="relative max-w-6xl mx-auto px-4 pb-10 sm:pb-16 pt-28 sm:pt-40 w-full">
          {!soldOut && <CountdownTimer targetIso={event.startsAt} />}
          {soldOut && (
            <span className="inline-block bg-red-600 rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-widest mb-5">
              Sold out
            </span>
          )}
          <h1 className="text-4xl sm:text-7xl font-extrabold tracking-tighter leading-[1.05] drop-shadow-lg max-w-3xl wrap-break-word">
            {event.title}
          </h1>
          {event.tagline && (
            <p className="text-lg sm:text-2xl text-zinc-200/90 mt-4 max-w-2xl leading-relaxed drop-shadow wrap-break-word">
              {event.tagline}
            </p>
          )}
          <p className="text-sm sm:text-base text-zinc-300 mt-4">
            {formatDateIST(event.startsAt)} · {event.venue}, {event.city}
          </p>
          <div className="mt-8">{cta}</div>
        </div>
      </section>

      {/* ---- Quick facts strip ---- */}
      <section className="border-y border-white/6 bg-[#171228]/60 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-6 grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          <Fact label="When" value={formatDateIST(event.startsAt)} />
          <Fact label="Where" value={`${event.venue}, ${event.city}`} />
          <Fact
            label="Availability"
            value={soldOut ? "Sold out" : `${remaining} of ${total} seats left`}
          />
          <Fact label="Tickets from" value={inr(fromPrice)} />
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4">
        {/* ---- About ---- */}
        <section className="py-16 grid lg:grid-cols-2 gap-10 items-start">
          <div>
            <SectionTitle>About the event</SectionTitle>
            <p className="text-zinc-300 whitespace-pre-line leading-relaxed wrap-break-word">
              {event.description}
            </p>
          </div>
          {event.gallery[0] && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={event.gallery[0]}
              alt={`${event.title} highlight`}
              className="rounded-2xl w-full aspect-video object-cover border border-zinc-800"
            />
          )}
        </section>

        {/* ---- Gallery ---- */}
        {event.gallery.length > 1 && (
          <section className="pb-16">
            <SectionTitle>Gallery</SectionTitle>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {event.gallery.slice(1).map((url, i) => (
                <div
                  key={url}
                  className={`overflow-hidden rounded-2xl border border-[#2a2450] ${
                    i % 5 === 0 ? "md:row-span-2" : ""
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={`${event.title} photo ${i + 2}`}
                    className={`w-full h-full object-cover hover:scale-105 transition-transform duration-500 ${
                      i % 5 === 0 ? "aspect-3/4 md:h-full" : "aspect-4/3"
                    }`}
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ---- Tickets ---- */}
        <section className="pb-16">
          <SectionTitle>Tickets</SectionTitle>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {tiers.map((tier, i) => {
              const cardCls = `block rounded-2xl border p-6 text-left transition-all duration-300 ${
                i === 0 ? "border-[#d99a45]/40 bg-[#d99a45]/5" : "border-[#2a2450] bg-[#171228]"
              } ${
                bookable
                  ? "hover:border-[#d99a45] hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(217,154,69,0.12)] cursor-pointer"
                  : "opacity-60 cursor-not-allowed"
              }`;

              const cardContent = (
                <>
                  <div className="flex items-baseline justify-between gap-2 mb-2">
                    <h3 className="font-bold text-lg wrap-break-word min-w-0">{tier.name}</h3>
                    {i === 0 && (
                      <span className="text-[10px] font-bold uppercase tracking-wide text-[#d99a45]">
                        Closest to stage
                      </span>
                    )}
                  </div>
                  <p className="text-3xl font-extrabold mb-3">{inr(tier.price)}</p>
                  <p className="text-sm text-zinc-400">{tier.seats} seats</p>
                </>
              );

              return bookable ? (
                <Link key={tier.id} href={`/events/${event.id}/book`} className={cardCls}>
                  {cardContent}
                </Link>
              ) : (
                <div key={tier.id} className={cardCls}>
                  {cardContent}
                </div>
              );
            })}
          </div>
          <div className="mt-8 text-center">{cta}</div>
          {event.bookMyShowUrl && (
            <div className="mt-6">
              <BookMyShowLink url={event.bookMyShowUrl} />
            </div>
          )}
        </section>

        {/* ---- FAQs ---- */}
        {event.faqs.length > 0 && (
          <section className="pb-16 max-w-3xl">
            <SectionTitle>Frequently asked questions</SectionTitle>
            <div className="space-y-3">
              {event.faqs.map((faq, i) => (
                <details
                  key={i}
                  className="bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-4 group"
                >
                  <summary className="cursor-pointer font-medium list-none flex items-center gap-3">
                    <span className="wrap-break-word min-w-0">{faq.question}</span>
                    <span className="ml-auto text-zinc-500 group-open:rotate-45 transition-transform">
                      +
                    </span>
                  </summary>
                  <p className="text-sm text-zinc-400 mt-3 wrap-break-word">{faq.answer}</p>
                </details>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* ---- Bottom CTA band ---- */}
      <section className={`relative overflow-hidden bg-linear-to-br ${event.poster}`}>
        <div className="absolute inset-0 bg-zinc-950/70" />
        <div className="relative max-w-6xl mx-auto px-4 py-16 text-center">
          <h2 className="text-2xl sm:text-3xl font-extrabold mb-2">
            {soldOut ? "This one's full — see you at the next one!" : "Don't miss it."}
          </h2>
          <p className="text-zinc-300 mb-6">
            {formatDateIST(event.startsAt)} · {event.venue}, {event.city}
          </p>
          {cta}
        </div>
      </section>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-6 flex items-center gap-3">
      <span className="w-8 h-1 rounded-full bg-linear-to-r from-[#d99a45] to-[#e8bd6b] inline-block" />
      {children}
    </h2>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-widest text-zinc-500 mb-1">{label}</p>
      <p className="text-sm font-semibold wrap-break-word">{value}</p>
    </div>
  );
}
