import { ExternalLink, Lock, type LucideIcon, RefreshCcw, Ticket, Timer } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import BackLink from "@/components/BackLink";
import EventFactStrip from "@/components/EventFactStrip";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import WhatsAppShare from "@/components/WhatsAppShare";
import { BOOKMYSHOW_LOGO_URL } from "@/constants";
import { getBookedSeats, getEvent } from "@/lib/db";
import { minPrice, registrationState, ticketTiers, totalSeats } from "@/lib/domain/events";
import { formatDateIST, inr } from "@/utils";

export async function EventDetailScreen({ id }: { id: string }) {
  const event = await getEvent(id);
  if (!event || !event.published) notFound();

  const booked = (await getBookedSeats(event.id)).length;
  const total = totalSeats(event);
  const left = total - booked;
  const soldOut = left <= 0;
  const reg = registrationState(event);
  const bookable = reg === "open" && !soldOut;
  const fromPrice = minPrice(event);
  const tiers = ticketTiers(event);

  return (
    <div className="min-h-screen text-slate-900">
      <SiteHeader />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <BackLink href="/">All events</BackLink>

        {/* Banner */}
        <div
          className={`relative mt-4 rounded-3xl overflow-hidden shadow-[0_16px_40px_rgba(15,23,42,0.10)] aspect-video bg-linear-to-br ${event.poster}`}
        >
          {(event.imageUrl || event.gallery[0]) && (
            // Falls back to the first gallery photo when no dedicated banner is set.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={event.imageUrl || event.gallery[0]}
              alt={event.title}
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/30 to-transparent" />
          <div className="absolute bottom-0 p-4 sm:p-6 text-white">
            {event.tagline && (
              <span className="inline-block text-[11px] font-semibold uppercase tracking-widest text-[#f59e0b] mb-1 drop-shadow">
                {event.tagline}
              </span>
            )}
            <h1 className="text-xl sm:text-3xl font-bold drop-shadow wrap-break-word">
              {event.title}
            </h1>
            <p className="text-xs sm:text-sm text-white/80 mt-1 drop-shadow">
              {formatDateIST(event.startsAt)} · {event.venue}, {event.city}
            </p>
          </div>
        </div>

        {/* Quick facts strip */}
        <div className="mt-6">
          <EventFactStrip event={event} remaining={left} />
        </div>

        <div className="grid lg:grid-cols-3 gap-8 mt-8">
          {/* Booking card — first on mobile so the CTA is immediately visible */}
          <aside className="lg:order-last bg-white/95 backdrop-blur border border-[#e5eaf1] rounded-2xl p-5 h-fit shadow-xl lg:sticky lg:top-20">
            <h2 className="font-semibold mb-4">Tickets</h2>
            <div className="space-y-2 mb-5">
              {tiers.map((tier) => (
                <div key={tier.id} className="flex justify-between text-sm">
                  <span className="text-slate-600">
                    {tier.name}
                    <span className="text-slate-400"> · {tier.seats} seats</span>
                  </span>
                  <span className="font-medium">{inr(tier.price)}</span>
                </div>
              ))}
            </div>

            <p className="text-sm mb-1">
              {soldOut ? (
                <span className="text-red-700 font-semibold">Sold out</span>
              ) : (
                <>
                  <span className="font-semibold">{left}</span>
                  <span className="text-slate-600"> of {total} seats available</span>
                </>
              )}
            </p>
            <p className="text-xs text-slate-500 mb-5">
              {reg === "upcoming" && `Bookings open ${formatDateIST(event.registrationOpensAt)}`}
              {reg === "open" && `Bookings close ${formatDateIST(event.registrationClosesAt)}`}
              {reg === "closed" && "Bookings for this event have closed"}
            </p>

            {bookable ? (
              <Link
                href={`/events/${event.id}/book`}
                className="block text-center bg-linear-to-r from-[#D4AF37] to-[#E6C35C] hover:brightness-105 text-[#081A3A] rounded-full px-6 py-3 font-semibold text-sm transition-all"
              >
                Select seats
              </Link>
            ) : (
              <span className="block text-center bg-slate-100 text-slate-500 rounded-full px-6 py-3 font-semibold text-sm cursor-not-allowed">
                {soldOut ? "Sold out" : reg === "upcoming" ? "Opening soon" : "Closed"}
              </span>
            )}

            {event.bookMyShowUrl && (
              <a
                href={event.bookMyShowUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 flex items-center justify-center gap-2 bg-[#c4242c] hover:bg-[#a91f26] text-white rounded-full px-4 py-2.5 font-semibold text-sm transition-colors"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={BOOKMYSHOW_LOGO_URL}
                  alt="BookMyShow"
                  className="h-4 w-auto bg-white rounded px-1 py-0.5"
                />
                Also on BookMyShow
                <ExternalLink className="w-4 h-4" aria-hidden="true" />
              </a>
            )}

            <div className="mt-3">
              {/* Plain text + WhatsApp *bold* only — no emoji (astral-plane
                  emoji get mangled to "�" by some WhatsApp share transports). */}
              <WhatsAppShare
                imageUrl={event.imageUrl || event.gallery[0]}
                lines={[
                  `*${event.title}*`,
                  event.tagline || "",
                  formatDateIST(event.startsAt),
                  `${event.venue}${event.city ? `, ${event.city}` : ""}`,
                  soldOut ? "" : `Tickets from ${inr(fromPrice)}`,
                  "",
                  "Book your seats:",
                ].filter(Boolean)}
              />
            </div>
          </aside>

          <div className="lg:col-span-2 space-y-10 min-w-0">
            <section>
              <h2 className="text-lg font-semibold mb-3">About this event</h2>
              <p className="text-slate-700 whitespace-pre-line wrap-break-word">
                {event.description}
              </p>
            </section>

            {event.gallery.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold mb-3">Gallery</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {event.gallery.map((url, i) => (
                    <div key={url} className="overflow-hidden rounded-xl border border-[#e5eaf1]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt={`${event.title} photo ${i + 1}`}
                        className="w-full h-full aspect-4/3 object-cover hover:scale-105 transition-transform duration-500"
                      />
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section>
              <h2 className="text-lg font-semibold mb-3">Good to know</h2>
              <ul className="grid sm:grid-cols-2 gap-3">
                <GoodToKnow
                  icon={Ticket}
                  text="Every attendee gets their own QR ticket — bring one per seat."
                />
                <GoodToKnow
                  icon={Lock}
                  text="Payments are secured by Razorpay; your card details never touch our servers."
                />
                <GoodToKnow
                  icon={Timer}
                  text="Seats are held for 8 minutes at checkout so no one grabs them mid-payment."
                />
                <GoodToKnow
                  icon={RefreshCcw}
                  text="Cancellations are refunded to your original payment method in 5–7 working days."
                />
              </ul>
            </section>

            {event.faqs.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold mb-3">Frequently asked questions</h2>
                <div className="space-y-3">
                  {event.faqs.map((faq, i) => (
                    <details
                      key={i}
                      className="bg-white border border-slate-200 rounded-xl px-4 py-3"
                    >
                      <summary className="cursor-pointer font-medium text-sm wrap-break-word">
                        {faq.question}
                      </summary>
                      <p className="text-sm text-slate-600 mt-2 wrap-break-word">{faq.answer}</p>
                    </details>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function GoodToKnow({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <li className="flex items-start gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3">
      <Icon className="w-5 h-5 shrink-0 text-[#1d4ed8]" aria-hidden="true" />
      <span className="text-sm text-slate-700 leading-relaxed">{text}</span>
    </li>
  );
}
