import BackLink from "@/components/BackLink";
import EventsCarousel from "@/components/EventsCarousel";
import LoginWizard from "@/components/LoginWizard";
import Logo from "@/components/Logo";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import { listPublishedEvents } from "@/lib/db";
import { registrationState } from "@/lib/domain/events";





/** Sign-in / sign-up presentation. The auth-redirect guard lives in the route. */
export async function LoginScreen({ next, idleExpired }: { next: string; idleExpired?: boolean }) {
  const events = (await listPublishedEvents())
    .filter((e) => registrationState(e) !== "closed")
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
    .slice(0, 8)
    .map((e) => ({
      id: e.id,
      title: e.title,
      imageUrl: e.imageUrl,
      poster: e.poster,
      startsAt: e.startsAt,
      venue: e.venue,
      city: e.city,
    }));

  return (
    <div className="min-h-screen text-slate-900">
      <SiteHeader />

      <main className="bg-[#f5f8ff] py-10 sm:py-16">
        <div className="max-w-5xl mx-auto px-4">
          <div className="grid lg:grid-cols-2 rounded-3xl overflow-hidden border border-[#e5eaf1] bg-white shadow-[0_24px_60px_rgba(15,23,42,0.14)]">
            {/* LEFT — brand panel + active-events carousel (desktop only) */}
            <div className="hidden lg:flex relative overflow-hidden flex-col items-center justify-center gap-6 p-10 bg-[#081A3A] text-white">
              <span
                aria-hidden="true"
                className="pointer-events-none absolute -top-16 -right-10 w-56 h-56 rounded-full bg-[#3b82f6]/30 blur-3xl float-slow"
              />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute -bottom-20 -left-10 w-56 h-56 rounded-full bg-[#E6C35C]/15 blur-3xl"
              />
              <div className="relative z-10 flex flex-col items-center gap-6 w-full">
                <Logo onDark />
                <p className="font-heading text-lg text-[#E6C35C] -mt-4">॥ संगीत ही ईश्वर है ॥</p>
                <div className="w-full max-w-sm">
                  <EventsCarousel events={events} />
                </div>
              </div>
            </div>

            {/* RIGHT — sign-in card */}
            <div className="flex flex-col items-center justify-center px-3 sm:px-10 py-10 sm:py-14">
              {/* Logo (mobile only — the brand panel is hidden below lg) */}
              <div className="lg:hidden mb-6">
                <Logo />
              </div>

              <div className="w-full max-w-sm">
                {/* Compact carousel (mobile only) */}
                <div className="lg:hidden mb-6">
                  <EventsCarousel events={events} compact />
                </div>

                {idleExpired && (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-400/20 rounded-lg px-3 py-2 mb-5">
                    Your session expired due to inactivity. Please sign in again.
                  </p>
                )}

                <LoginWizard next={next} />

                <p className="flex justify-center mt-6">
                  <BackLink href="/" className="text-slate-500 hover:text-slate-700">
                    Back to site
                  </BackLink>
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}