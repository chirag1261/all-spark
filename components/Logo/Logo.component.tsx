import Link from "next/link";

interface Props {
  href?: string;
  /** Adds the small "admin" superscript badge used in the dashboard header. */
  admin?: boolean;
}

/** Shared wordmark — single source of truth so the public and admin headers never drift. */
export default function Logo({ href = "/", admin = false }: Props) {
  return (
    <Link href={href} className="text-xl font-extrabold tracking-tight shrink-0">
      Utsav{" "}
      <span className="text-transparent bg-clip-text bg-linear-to-r from-[#f84464] to-[#ff2e63]">
        Events
      </span>
      {admin && (
        <span className="ml-1.5 text-[10px] font-semibold uppercase text-zinc-500 align-super">
          admin
        </span>
      )}
    </Link>
  );
}
