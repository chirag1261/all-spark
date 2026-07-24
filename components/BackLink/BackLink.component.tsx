import { ChevronLeft } from "lucide-react";
import Link from "next/link";

interface Props {
  href: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * A "back" link with a crisp chevron — used instead of a plain "←" character,
 * which renders inconsistently across fonts/platforms (thin, misaligned with
 * the text baseline, or missing entirely on some systems).
 */
export default function BackLink({ href, children, className = "" }: Props) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-800 transition-colors ${className}`}
    >
      <ChevronLeft className="w-4 h-4 shrink-0" aria-hidden="true" />
      {children}
    </Link>
  );
}
