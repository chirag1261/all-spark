"use client";

import { useRouter } from "next/navigation";

import PromoCodeForm from "../PromoCodeForm";

interface EventOption {
  id: string;
  title: string;
}

/** Full-page create wrapper — sends the admin back to the list on save/cancel. */
export default function PromoCodeCreate({ events }: { events: EventOption[] }) {
  const router = useRouter();
  return <PromoCodeForm events={events} onDone={() => router.push("/admin/promocodes")} />;
}
