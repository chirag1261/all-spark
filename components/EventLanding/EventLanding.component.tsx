import { MapPin } from "lucide-react";
import Link from "next/link";

import { minPrice, registrationState, ticketTiers } from "@/lib/domain/events";
import { EventItem } from "@/types";
import { formatDateIST, inr } from "@/utils";

import BookMyShowLink from "../BookMyShowLink";
import CountdownTimer from "../CountdownTimer";
import EventFactStrip from "../EventFactStrip";
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
  const fromPrice = minPrice(event);
  const tiers = ticketTiers(event);

  const cta = bookable ? (
    <Link
      href={`/events/${event.id}/book`}
      className="inline-block w-full sm:w-auto text-center bg-linear-to-r from-[#D4AF37] to-[#E6C35C] hover:brightness-105 text-[#081A3A] hover:scale-[1.02] rounded-full px-9 py-4 font-bold text-base transition-all"
    >
      Book tickets · from {inr(fromPrice)}
    </Link>
  ) : (
    <span className="inline-block w-full sm:w-auto text-center bg-slate-100 text-slate-600 rounded-full px-8 py-4 font-bold text-base cursor-not-allowed">
      {soldOut
        ? "Sold out"
        : reg === "upcoming"
          ? `Bookings open ${formatDateIST(event.registrationOpensAt)}`
          : "Bookings closed"}
    </span>
  );

  return (
    <div className="pb-24 sm:pb-0">
      {/* ---- Hero: auto-playing media canvas ---- */}
      <section
        className={`relative min-h-[78vh] flex items-end overflow-hidden bg-linear-to-br ${event.poster}`}
      >
        <HeroMedia
          images={[...new Set([event.imageUrl, ...event.gallery].filter(Boolean))]}
          alt={event.title}
        />
        <div className="absolute inset-0 bg-linear-to-t from-[#0d0a1f] via-[#0d0a1f]/55 to-[#0d0a1f]/10" />
        <div className="relative max-w-6xl mx-auto px-4 pb-10 sm:pb-16 pt-28 sm:pt-40 w-full text-white">
          {!soldOut && <CountdownTimer targetIso={event.startsAt} />}
          {soldOut && (
            <span className="inline-block bg-red-600 rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-widest mb-5">
              Sold out
            </span>
          )}
          {event.landing?.presenter && (
            <p className="text-xs sm:text-sm font-semibold uppercase tracking-[0.2em] text-[#E6C35C] mb-3 drop-shadow">
              {event.landing.presenter}
            </p>
          )}
          <h1 className="text-4xl sm:text-7xl font-extrabold tracking-tighter leading-[1.05] drop-shadow-lg max-w-3xl wrap-break-word">
            {event.title}
          </h1>
          {event.landing?.heroKicker && (
            <p className="font-heading text-xl sm:text-3xl text-[#E6C35C] mt-3 drop-shadow">
              {event.landing.heroKicker}
            </p>
          )}
          {event.tagline && (
            <p className="text-lg sm:text-2xl text-white/90 mt-4 max-w-2xl leading-relaxed drop-shadow wrap-break-word">
              {event.tagline}
            </p>
          )}
          <p className="text-sm sm:text-base text-white/80 mt-4">
            {formatDateIST(event.startsAt)} · {event.venue}, {event.city}
          </p>
          {/* Hidden on mweb — the fixed bottom bar already surfaces this CTA
              there, so showing it here too would just be a duplicate. */}
          <div className="hidden sm:block mt-8">{cta}</div>
        </div>
      </section>

      {/* ---- Quick facts strip ---- */}
      <section className="max-w-6xl mx-auto px-4 mt-10 relative">
        <EventFactStrip event={event} remaining={remaining} />
      </section>

      <div className="section-y max-w-6xl mx-auto px-4 space-y-14 sm:space-y-20">
        {/* ---- About ---- */}
        <section className="grid lg:grid-cols-2 gap-10 items-start">
          <div>
            <SectionTitle>About the event</SectionTitle>
            <p className="text-slate-700 whitespace-pre-line leading-relaxed wrap-break-word">
              {event.description}
            </p>
          </div>
          {event.gallery[0] && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={event.gallery[0]}
              alt={`${event.title} highlight`}
              className="rounded-2xl w-full aspect-video object-cover border border-slate-200"
            />
          )}
        </section>

        {/* ---- Why attend ---- */}
        {event.landing?.whyAttend && event.landing.whyAttend.length > 0 && (
          <section>
            <SectionTitle>{`Why attend ${event.title}`}</SectionTitle>
            <div className="grid sm:grid-cols-3 gap-5">
              {event.landing.whyAttend.map((c, i) => (
                <div
                  key={i}
                  className="bg-white border border-[#e5eaf1] rounded-3xl p-6 hover:border-[#1d4ed8]/40 hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(29,78,216,0.10)] transition-all duration-300"
                >
                  <span className="font-heading text-3xl font-semibold text-[#1d4ed8]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="font-heading text-xl font-semibold mt-2 mb-2 wrap-break-word">
                    {c.title}
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed wrap-break-word">{c.body}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ---- Gallery ---- */}
        {event.gallery.length > 1 && (
          <section>
            <SectionTitle>Gallery</SectionTitle>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {event.gallery.slice(1).map((url, i) => (
                <div key={url} className="overflow-hidden rounded-2xl border border-[#e5eaf1]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={`${event.title} photo ${i + 2}`}
                    className="w-full aspect-4/3 object-cover hover:scale-105 transition-transform duration-500"
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ---- Featured artist ---- */}
        {event.landing?.artist && (
          <section className="relative overflow-hidden rounded-3xl border border-[#1d4ed8]/15 bg-linear-to-br from-[#0f1e4d] via-[#12245b] to-[#1d3a86] gradient-pan text-white px-6 sm:px-10 lg:px-14 py-10 sm:py-14 shadow-[0_24px_60px_rgba(15,23,42,0.18)]">
            {/* Decorative glow ornaments */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -top-16 -right-10 w-56 h-56 rounded-full bg-[#3b82f6]/25 blur-3xl float-slow"
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-20 -left-10 w-56 h-56 rounded-full bg-[#E6C35C]/15 blur-3xl"
            />
            <div className="relative grid lg:grid-cols-2 gap-8 lg:gap-14 items-center">
              {event.landing.artist.imageUrl && (
                <div className="relative">
                  <span
                    aria-hidden="true"
                    className="absolute -inset-3 rounded-3xl bg-linear-to-tr from-[#E6C35C]/40 to-[#3b82f6]/40 blur-xl opacity-60"
                  />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={event.landing.artist.imageUrl}
                    alt={event.landing.artist.name}
                    className="relative rounded-2xl w-full aspect-3/4 object-cover ring-1 ring-white/15 shadow-[0_24px_60px_rgba(0,0,0,0.4)]"
                  />
                </div>
              )}
              <div>
                <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-[#E6C35C] mb-3">
                  <span className="w-6 h-px bg-[#E6C35C]" /> Featured artist
                </p>
                <h2 className="font-heading text-3xl sm:text-5xl font-semibold wrap-break-word leading-tight">
                  {event.landing.artist.name}
                </h2>
                {event.landing.artist.title && (
                  <p className="font-heading italic text-lg text-[#93c5fd] mt-2">
                    {event.landing.artist.title}
                  </p>
                )}
                {event.landing.artist.bio && (
                  <p className="text-white/75 leading-relaxed whitespace-pre-line mt-5 wrap-break-word">
                    {event.landing.artist.bio}
                  </p>
                )}
                {event.landing.artist.stats.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-7">
                    {event.landing.artist.stats.map((s, i) => (
                      <div
                        key={i}
                        className="rounded-2xl border border-white/15 bg-white/5 backdrop-blur px-4 py-3.5 text-center"
                      >
                        <p className="font-heading text-2xl font-semibold text-[#E6C35C] wrap-break-word">
                          {s.value}
                        </p>
                        <p className="text-xs text-white/60 mt-1 wrap-break-word">{s.label}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* ---- Tickets ---- */}
        <section>
          <SectionTitle>Tickets</SectionTitle>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {tiers.map((tier, i) => {
              const cardCls = `block rounded-2xl border p-6 text-left transition-all duration-300 ${
                i === 0 ? "border-[#1d4ed8]/40 bg-[#1d4ed8]/5" : "border-[#e5eaf1] bg-white"
              } ${
                bookable
                  ? "hover:border-[#1d4ed8] hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(29,78,216,0.12)] cursor-pointer"
                  : "opacity-60 cursor-not-allowed"
              }`;

              const cardContent = (
                <>
                  <div className="flex items-baseline justify-between gap-2 mb-2">
                    <h3 className="font-bold text-lg wrap-break-word min-w-0">{tier.name}</h3>
                    {i === 0 && (
                      <span className="text-[10px] font-bold uppercase tracking-wide text-[#1d4ed8]">
                        Closest to stage
                      </span>
                    )}
                  </div>
                  <p className="text-3xl font-extrabold mb-3">{inr(tier.price)}</p>
                  <p className="text-sm text-slate-600">{tier.seats} seats</p>
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

        {/* ---- Event details + evening schedule ---- */}
        {event.landing && (event.landing.details?.length || event.landing.schedule?.length) ? (
          <section>
            <SectionTitle>Event details</SectionTitle>
            <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
              {event.landing.details && event.landing.details.length > 0 && (
                <div className="rounded-2xl border border-[#e5eaf1] bg-white divide-y divide-[#e5eaf1]">
                  {event.landing.details.map((d, i) => (
                    <div key={i} className="px-5 py-4">
                      <p className="text-[11px] uppercase tracking-widest text-[#1d4ed8] mb-1">
                        {d.label}
                      </p>
                      <p className="text-sm font-medium wrap-break-word">{d.value}</p>
                    </div>
                  ))}
                </div>
              )}
              {event.landing.schedule && event.landing.schedule.length > 0 && (
                <div>
                  <h3 className="font-heading text-2xl font-semibold mb-4">Evening schedule</h3>
                  <ol className="relative border-l border-[#e5eaf1] ml-2 space-y-6">
                    {event.landing.schedule.map((s, i) => (
                      <li key={i} className="pl-6">
                        <span className="absolute -left-1.5 mt-1.5 w-3 h-3 rounded-full bg-[#1d4ed8]" />
                        <p className="font-mono text-xs font-semibold text-[#1d4ed8]">{s.time}</p>
                        <p className="font-semibold wrap-break-word">{s.title}</p>
                        {s.description && (
                          <p className="text-sm text-slate-600 wrap-break-word">{s.description}</p>
                        )}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          </section>
        ) : null}

        {/* ---- The venue ---- */}
        {event.landing?.venue && (
          <section className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            <div>
              <SectionTitle>The venue</SectionTitle>
              <h3 className="text-xl font-bold wrap-break-word">{event.landing.venue.name}</h3>
              {event.landing.venue.address && (
                <p className="flex items-center gap-1.5 text-sm text-[#1d4ed8] mt-1.5">
                  <MapPin className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span className="wrap-break-word">{event.landing.venue.address}</span>
                </p>
              )}
              {event.landing.venue.description && (
                <p className="text-slate-700/90 leading-relaxed mt-4 wrap-break-word">
                  {event.landing.venue.description}
                </p>
              )}
              {event.landing.venue.accessibility && (
                <p className="text-sm text-slate-500 mt-4 wrap-break-word">
                  {event.landing.venue.accessibility}
                </p>
              )}
            </div>
            {event.landing.venue.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={event.landing.venue.imageUrl}
                alt={event.landing.venue.name}
                className="rounded-2xl w-full aspect-video object-cover border border-[#e5eaf1] shadow-[0_16px_40px_rgba(15,23,42,0.10)]"
              />
            )}
          </section>
        )}

        {/* ---- FAQs (kept last, after every other detail section) ---- */}
        {event.faqs.length > 0 && (
          <section className="max-w-3xl">
            <SectionTitle>Frequently asked questions</SectionTitle>
            <div className="space-y-3">
              {event.faqs.map((faq, i) => (
                <details
                  key={i}
                  className="bg-white border border-slate-200 rounded-xl px-5 py-4 group"
                >
                  <summary className="cursor-pointer font-medium list-none flex items-center gap-3">
                    <span className="wrap-break-word min-w-0">{faq.question}</span>
                    <span className="ml-auto text-slate-500 group-open:rotate-45 transition-transform">
                      +
                    </span>
                  </summary>
                  <p className="text-sm text-slate-600 mt-3 wrap-break-word">{faq.answer}</p>
                </details>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* ---- Bottom CTA band ---- */}
      <section className={`relative overflow-hidden bg-linear-to-br ${event.poster}`}>
        <div className="absolute inset-0 bg-white/90" />
        <div className="section-y relative max-w-6xl mx-auto px-4 text-center">
          <h2 className="text-2xl sm:text-3xl font-extrabold mb-2">
            {soldOut ? "This one's full — see you at the next one!" : "Don't miss it."}
          </h2>
          <p className="text-slate-700 mb-6">
            {formatDateIST(event.startsAt)} · {event.venue}, {event.city}
          </p>
          {cta}
        </div>
      </section>

      {/* ---- Mobile-only persistent booking bar — desktop already has the
          CTA inline in three places (hero, tickets, closing band), which is
          plenty of visibility on a wide screen; mweb needs it reachable
          without scrolling back up. */}
      <div className="sm:hidden fixed inset-x-0 bottom-0 z-50 bg-white border-t border-slate-200 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        {cta}
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-6 flex items-center gap-3">
      <span className="w-8 h-1 rounded-full bg-linear-to-r from-[#1d4ed8] to-[#3b82f6] inline-block" />
      {children}
    </h2>
  );
}
