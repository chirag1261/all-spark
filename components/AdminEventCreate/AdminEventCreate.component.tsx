"use client";

import { useRouter } from "next/navigation";

import EventForm from "../EventForm";

/** Create-event screen body: EventForm in create mode, returning to the list on done. */
export default function AdminEventCreate({ cloudinaryEnabled }: { cloudinaryEnabled: boolean }) {
  const router = useRouter();
  return (
    <EventForm
      cloudinaryEnabled={cloudinaryEnabled}
      onDone={() => {
        router.push("/admin/events");
        router.refresh();
      }}
    />
  );
}
