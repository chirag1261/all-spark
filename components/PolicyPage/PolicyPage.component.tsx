import BackLink from "../BackLink";
import SiteFooter from "../SiteFooter";
import SiteHeader from "../SiteHeader";

export interface PolicySection {
  heading: string;
  /** Body paragraphs, rendered in order. */
  paragraphs?: string[];
  /** Optional bulleted list rendered after the paragraphs. */
  bullets?: string[];
}

interface Props {
  title: string;
  /** e.g. "Last updated: 21 July 2026" */
  updated: string;
  /** Short lead paragraph under the title. */
  intro?: string;
  sections: PolicySection[];
}

/** Shared chrome + typography for the legal / policy pages. */
export default function PolicyPage({ title, updated, intro, sections }: Props) {
  return (
    <div className="min-h-screen text-zinc-100">
      <SiteHeader />
      <main className="max-w-3xl mx-auto px-4 py-10">
        <BackLink href="/">Home</BackLink>
        <h1 className="font-heading text-3xl sm:text-4xl font-semibold mt-4 mb-1">{title}</h1>
        <p className="text-xs uppercase tracking-widest text-zinc-500 mb-8">{updated}</p>
        {intro && <p className="text-zinc-300/90 leading-relaxed mb-8">{intro}</p>}

        <div className="space-y-8">
          {sections.map((section, i) => (
            <section key={i}>
              <h2 className="font-heading text-xl sm:text-2xl font-semibold text-zinc-100 mb-3">
                {i + 1}. {section.heading}
              </h2>
              {section.paragraphs?.map((p, j) => (
                <p key={j} className="text-sm text-zinc-400 leading-relaxed mb-3 wrap-break-word">
                  {p}
                </p>
              ))}
              {section.bullets && (
                <ul className="list-disc list-inside space-y-1.5 text-sm text-zinc-400 marker:text-[#f5a524]">
                  {section.bullets.map((b, j) => (
                    <li key={j} className="wrap-break-word">
                      {b}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>

        <p className="text-xs text-zinc-500 mt-12 border-t border-zinc-800 pt-6">
          Questions about this policy? Email{" "}
          <a href="mailto:utsavevents.tech@gmail.com" className="text-[#f5a524] hover:underline">
            utsavevents.tech@gmail.com
          </a>
          . This document is provided for transparency and should be reviewed by the organiser
          before relying on it.
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
