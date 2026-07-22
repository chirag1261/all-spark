import type { Metadata } from "next";

import { AboutScreen } from "@/screens";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "About — Utsav Events",
  description:
    "Utsav Events is a Bangalore-based cultural organisation preserving and celebrating India's tradition of devotional music through extraordinary live experiences.",
};

export default function Page() {
  return <AboutScreen />;
}
