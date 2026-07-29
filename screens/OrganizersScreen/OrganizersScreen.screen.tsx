import Link from "next/link";

import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import { listPublishedOrganizers } from "@/lib/db";

/** Public page — the organizing team, admin-managed via /admin/organizers. */
export async function OrganizersScreen() {
  const organizers = await listPublishedOrganizers();

  return (
    <div className="min-h-screen text-slate-900">
      <SiteHeader />
      <main className="section-y max-w-6xl mx-auto px-4">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <p className="font-heading text-[#1d4ed8] text-lg mb-1">Behind the scenes</p>
          <h1 className="font-heading text-3xl sm:text-5xl font-semibold">Organizers</h1>
          <p className="text-slate-600 mt-3 leading-relaxed">
            The team bringing every gathering to life — reach out to any of us at our{" "}
            <Link href="/contact" className="text-[#1d4ed8] hover:underline">
              contact page
            </Link>
            .
          </p>
        </div>

        {organizers.length === 0 ? (
          <p className="text-slate-500 text-center py-16">Organizer profiles are coming soon.</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {organizers.map((o) => (
              <div
                key={o.id}
                className="bg-linear-to-br from-[#eff4ff] via-white to-[#fdf6e8] border border-[#e5eaf1] rounded-3xl p-6 text-center hover:border-[#1d4ed8]/40 hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(29,78,216,0.10)] transition-all duration-300"
              >
                {o.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={o.photoUrl}
                    alt={o.name}
                    className="w-28 h-28 rounded-full object-cover mx-auto mb-4 border border-[#e5eaf1]"
                  />
                ) : (
                  <div className="w-28 h-28 rounded-full bg-[#eff4ff] text-[#1d4ed8] flex items-center justify-center mx-auto mb-4 text-3xl font-bold">
                    {o.name.trim().charAt(0).toUpperCase() || "?"}
                  </div>
                )}
                <h2 className="font-heading text-lg font-semibold wrap-break-word">{o.name}</h2>
                {o.role && <p className="text-sm text-[#1d4ed8] mt-0.5 wrap-break-word">{o.role}</p>}
                {o.bio && (
                  <p className="text-sm text-slate-600 leading-relaxed mt-3 wrap-break-word">
                    {o.bio}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
