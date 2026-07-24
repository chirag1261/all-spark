"use client";

import { useRouter } from "next/navigation";

import { EventItem } from "@/types";

import EventForm from "../EventForm";

interface Props {
  cloudinaryEnabled: boolean;
  /** Prefills the form from an existing event (the "Clone" action). */
  cloneFrom?: EventItem;
}

/** Create-event screen body: EventForm in create mode, returning to the list on done. */
export default function AdminEventCreate({ cloudinaryEnabled, cloneFrom }: Props) {
  const router = useRouter();
  return (
    <EventForm
      cloudinaryEnabled={cloudinaryEnabled}
      cloneFrom={cloneFrom}
      onDone={() => {
        router.push("/admin/events");
        router.refresh();
      }}
    />
  );
}
