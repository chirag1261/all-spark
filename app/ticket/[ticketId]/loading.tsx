import Loader from "@/components/Loader";

/** Fallback while a ticket page renders (e.g. straight after payment). */
export default function Loading() {
  return <Loader fullscreen label="Preparing your ticket…" />;
}
