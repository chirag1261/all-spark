import { ExternalLink, Lock, type LucideIcon, RefreshCcw, Ticket, Timer } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BOOKMYSHOW_LOGO_URL } from "@/constants";
import BackLink from "@/components/BackLink";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
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
    <div className="min-h-screen text-zinc-100">
      <SiteHeader />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <BackLink href="/">All events</BackLink>

        {/* Banner */}
        <div
          className={`relative mt-4 rounded-3xl overflow-hidden shadow-[0_24px_60px_rgba(0,0,0,0.45)] aspect-video sm:aspect-21/9 bg-linear-to-br ${event.poster}`}
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
          <div className="absolute bottom-0 p-4 sm:p-6">
            {event.tagline && (
              <span className="inline-block text-[11px] font-semibold uppercase tracking-widest text-[#ffce7a] mb-1 drop-shadow">
                {event.tagline}
              </span>
            )}
            <h1 className="text-xl sm:text-3xl font-bold drop-shadow wrap-break-word">
              {event.title}
            </h1>
            <p className="text-xs sm:text-sm text-zinc-200 mt-1 drop-shadow">
              {formatDateIST(event.startsAt)} · {event.venue}, {event.city}
            </p>
          </div>
        </div>

        {/* Quick facts strip */}
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Fact label="When" value={formatDateIST(event.startsAt)} />
          <Fact label="Where" value={`${event.venue}, ${event.city}`} />
          <Fact
            label="Availability"
            value={soldOut ? "Sold out" : `${left} of ${total} seats left`}
          />
          <Fact label="Tickets from" value={inr(fromPrice)} />
        </div>

        <div className="grid lg:grid-cols-3 gap-8 mt-8">
          {/* Booking card — first on mobile so the CTA is immediately visible */}
          <aside className="lg:order-last bg-[#171228]/90 backdrop-blur border border-[#2a2450] rounded-2xl p-5 h-fit shadow-xl lg:sticky lg:top-20">
            <h2 className="font-semibold mb-4">Tickets</h2>
            <div className="space-y-2 mb-5">
              {tiers.map((tier) => (
                <div key={tier.id} className="flex justify-between text-sm">
                  <span className="text-zinc-400">
                    {tier.name}
                    <span className="text-zinc-600"> · {tier.seats} seats</span>
                  </span>
                  <span className="font-medium">{inr(tier.price)}</span>
                </div>
              ))}
            </div>

            <p className="text-sm mb-1">
              {soldOut ? (
                <span className="text-red-400 font-semibold">Sold out</span>
              ) : (
                <>
                  <span className="font-semibold">{left}</span>
                  <span className="text-zinc-400"> of {total} seats available</span>
                </>
              )}
            </p>
            <p className="text-xs text-zinc-500 mb-5">
              {reg === "upcoming" && `Bookings open ${formatDateIST(event.registrationOpensAt)}`}
              {reg === "open" && `Bookings close ${formatDateIST(event.registrationClosesAt)}`}
              {reg === "closed" && "Bookings for this event have closed"}
            </p>

            {bookable ? (
              <Link
                href={`/events/${event.id}/book`}
                className="block text-center bg-[#d99a45] hover:bg-[#bf863a] rounded-lg px-6 py-3 font-semibold text-sm transition-colors"
              >
                Select seats
              </Link>
            ) : (
              <span className="block text-center bg-zinc-800 text-zinc-500 rounded-lg px-6 py-3 font-semibold text-sm cursor-not-allowed">
                {soldOut ? "Sold out" : reg === "upcoming" ? "Opening soon" : "Closed"}
              </span>
            )}

            {event.bookMyShowUrl && (
              <a
                href={event.bookMyShowUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 flex items-center justify-center gap-2 bg-[#c4242c] hover:bg-[#a91f26] text-white rounded-lg px-4 py-2.5 font-semibold text-sm transition-colors"
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
          </aside>

          <div className="lg:col-span-2 space-y-10 min-w-0">
            <section>
              <h2 className="text-lg font-semibold mb-3">About this event</h2>
              <p className="text-zinc-300 whitespace-pre-line wrap-break-word">
                {event.description}
              </p>
            </section>

            {event.gallery.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold mb-3">Gallery</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {event.gallery.map((url, i) => (
                    <div key={url} className="overflow-hidden rounded-xl border border-[#2a2450]">
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
                      className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3"
                    >
                      <summary className="cursor-pointer font-medium text-sm wrap-break-word">
                        {faq.question}
                      </summary>
                      <p className="text-sm text-zinc-400 mt-2 wrap-break-word">{faq.answer}</p>
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

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#171228] border border-[#2a2450] rounded-xl px-4 py-3">
      <p className="text-[11px] uppercase tracking-widest text-zinc-500 mb-1">{label}</p>
      <p className="text-sm font-semibold wrap-break-word">{value}</p>
    </div>
  );
}

function GoodToKnow({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <li className="flex items-start gap-3 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
      <Icon className="w-5 h-5 shrink-0 text-[#d99a45]" aria-hidden="true" />
      <span className="text-sm text-zinc-300 leading-relaxed">{text}</span>
    </li>
  );
}
