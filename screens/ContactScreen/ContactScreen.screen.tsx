import { CalendarDays, ExternalLink, Mail, MapPin, Phone } from "lucide-react";
import Link from "next/link";

import ContactForm from "@/components/ContactForm";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import { getFeaturedEvent } from "@/lib/db";
import { formatDateIST } from "@/utils";

const CONTACT = {
  email: "Admin@utsavevents.in",
  phone: "+91 9620710968",
  location: "Bangalore, Karnataka, India",
};

export async function ContactScreen() {
  const featured = await getFeaturedEvent();

  return (
    <div className="min-h-screen text-zinc-100">
      <SiteHeader />
      <main className="section-y max-w-6xl mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-start">
          {/* Left — get in touch */}
          <div>
            <h1 className="font-heading text-3xl sm:text-4xl font-semibold mb-6">Get in Touch</h1>
            <ul className="space-y-4">
              <ContactRow
                icon={Mail}
                label="Email"
                value={CONTACT.email}
                href={`mailto:${CONTACT.email}`}
              />
              <ContactRow
                icon={Phone}
                label="Phone"
                value={CONTACT.phone}
                href={`tel:${CONTACT.phone.replace(/\s/g, "")}`}
              />
              <ContactRow icon={MapPin} label="Location" value={CONTACT.location} />
            </ul>

            {featured && (
              <div className="mt-8 bg-[#171228] border border-[#2a2450] rounded-3xl p-6">
                <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#d99a45] mb-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#d99a45]" />
                  Upcoming event
                </p>
                <h2 className="font-heading text-xl font-semibold">Registering for {featured.title}?</h2>
                <p className="text-sm text-zinc-400 mt-2 leading-relaxed">
                  Choose your seats and register directly through our site — we&apos;ll confirm your
                  booking by email with an individual QR ticket for every attendee.
                </p>
                <p className="flex items-center gap-2 text-sm text-zinc-300 mt-4">
                  <CalendarDays className="w-4 h-4 shrink-0 text-[#d99a45]" aria-hidden="true" />
                  {formatDateIST(featured.startsAt)}
                </p>
                <p className="flex items-center gap-2 text-sm text-zinc-300 mt-1">
                  <MapPin className="w-4 h-4 shrink-0 text-[#d99a45]" aria-hidden="true" />
                  {featured.venue}, {featured.city}
                </p>
                {featured.bookMyShowUrl && (
                  <a
                    href={featured.bookMyShowUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-5 flex items-center justify-center gap-2 bg-[#f84464] hover:brightness-110 text-white font-semibold rounded-full px-5 py-2.5 text-sm transition-all"
                  >
                    Tickets are also available on BookMyShow
                    <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                  </a>
                )}
                <Link
                  href={`/events/${featured.id}`}
                  className="mt-3 flex items-center justify-center gap-1.5 text-sm font-semibold text-[#d99a45] hover:text-[#e8bd6b]"
                >
                  View full event details →
                </Link>
              </div>
            )}
          </div>

          {/* Right — message form */}
          <ContactForm />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function ContactRow({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: typeof Mail;
  label: string;
  value: string;
  href?: string;
}) {
  const body = (
    <div className="flex items-center gap-4">
      <span className="w-11 h-11 shrink-0 rounded-full bg-[#d99a45]/10 text-[#d99a45] flex items-center justify-center">
        <Icon className="w-5 h-5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-widest text-zinc-500">{label}</p>
        <p className="font-semibold wrap-break-word">{value}</p>
      </div>
    </div>
  );
  return (
    <li>
      {href ? (
        <a href={href} className="block hover:opacity-80 transition-opacity">
          {body}
        </a>
      ) : (
        body
      )}
    </li>
  );
}
