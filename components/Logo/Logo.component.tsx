import Link from "next/link";

interface Props {
  href?: string;
  /** Adds the small "admin" superscript badge used in the dashboard header. */
  admin?: boolean;
}

/** Shared wordmark — single source of truth so the public and admin headers never drift. */
export default function Logo({ href = "/", admin = false }: Props) {
  return (
    <Link href={href} className="flex items-center gap-2.5 shrink-0">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/utsav/logo.png" alt="Utsav Events" className="h-9 w-9 object-contain" />
      <span className="font-heading text-2xl font-semibold tracking-tight leading-none">
        Utsav{" "}
        <span className="text-transparent bg-clip-text bg-linear-to-r from-[#f5a524] to-[#ffc132]">
          Events
        </span>
        {admin && (
          <span className="ml-1.5 text-[10px] font-sans font-semibold uppercase text-zinc-500 align-super">
            admin
          </span>
        )}
      </span>
    </Link>
  );
}
