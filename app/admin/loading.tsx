import Loader from "@/components/Loader";

/** Fallback for admin routes while their server components render. */
export default function Loading() {
  return <Loader fullscreen label="Loading…" />;
}
