import Loader from "@/components/Loader";

/** Route-level fallback shown while a slow page's server component renders. */
export default function Loading() {
  return <Loader fullscreen label="Loading…" />;
}
