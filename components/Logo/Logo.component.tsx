import Link from "next/link";

interface Props {
  href?: string;
  /** Adds the small "admin" superscript badge used in the dashboard header. */
  admin?: boolean;
  /** Recolors the wordmark for a dark background (dark-blue site header). */
  onDark?: boolean;
}

/** Shared wordmark — single source of truth so the public and admin headers never drift. */
export default function Logo({ href = "/", admin = false, onDark = false }: Props) {
  return (
    <Link href={href} className="flex items-center gap-2.5 shrink-0">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="https://res.cloudinary.com/cih7cika/image/upload/f_auto,q_auto,w_240/utsav-events/logo"
        alt="Utsav Events"
        className="h-9 w-9 object-contain"
      />
      <span
        className={`font-heading text-2xl font-semibold tracking-tight leading-none ${
          onDark ? "text-white" : ""
        }`}
      >
        Utsav{" "}
        <span
          className={`text-transparent bg-clip-text bg-linear-to-r ${
            onDark ? "from-[#fbbf24] to-[#fde68a]" : "from-[#1d4ed8] to-[#3b82f6]"
          }`}
        >
          Events
        </span>
        {admin && (
          <span className="ml-1.5 text-[10px] font-sans font-semibold uppercase text-slate-500 align-super">
            admin
          </span>
        )}
      </span>
    </Link>
  );
}
