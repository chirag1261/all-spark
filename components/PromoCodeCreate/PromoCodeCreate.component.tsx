"use client";

import { useRouter } from "next/navigation";

import { PromoCode } from "@/types";

import PromoCodeForm from "../PromoCodeForm";

interface EventOption {
  id: string;
  title: string;
}

interface Props {
  events: EventOption[];
  /** Prefills the form from an existing promo code (the "Clone" action). */
  cloneFrom?: PromoCode;
}

/** Full-page create wrapper — sends the admin back to the list on save/cancel. */
export default function PromoCodeCreate({ events, cloneFrom }: Props) {
  const router = useRouter();
  return (
    <PromoCodeForm
      events={events}
      cloneFrom={cloneFrom}
      onDone={() => router.push("/admin/promocodes")}
    />
  );
}
