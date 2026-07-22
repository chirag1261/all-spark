import BackLink from "@/components/BackLink";
import EventsCarousel from "@/components/EventsCarousel";
import Logo from "@/components/Logo";
import LoginWizard from "@/components/LoginWizard";
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
    <div className="min-h-screen flex text-zinc-100">
      {/* LEFT — brand panel + active-events carousel (desktop only) */}
      <div className="hidden md:flex flex-1 flex-col items-center justify-center gap-6 bg-[#171228] p-10 border-r border-[#2a2450]">
        <Logo />
        <p className="font-heading text-lg text-[#d99a45]/90 -mt-4">॥ संगीत ही ईश्वर है ॥</p>
        <div className="w-full max-w-sm">
          <EventsCarousel events={events} />
        </div>
      </div>

      {/* RIGHT — sign-in card */}
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-10 bg-[#0d0a1f]">
        {/* Logo (mobile only — the brand panel is hidden below md) */}
        <div className="md:hidden mb-6">
          <Logo />
        </div>

        <div className="w-full max-w-sm">
          {/* Compact carousel (mobile only) */}
          <div className="md:hidden mb-6">
            <EventsCarousel events={events} compact />
          </div>

          {idleExpired && (
            <p className="text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-lg px-3 py-2 mb-5">
              Your session expired due to inactivity. Please sign in again.
            </p>
          )}

          <LoginWizard next={next} />

          <p className="flex justify-center mt-6">
            <BackLink href="/" className="text-zinc-500 hover:text-zinc-300">
              Back to site
            </BackLink>
          </p>
        </div>
      </div>
    </div>
  );
}
