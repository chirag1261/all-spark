import { AdminBookingsScreen } from "@/screens";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: PageProps<"/admin/bookings">) {
  const sp = await searchParams;
  return (
    <AdminBookingsScreen
      q={typeof sp.q === "string" ? sp.q : ""}
      eventId={typeof sp.eventId === "string" ? sp.eventId : ""}
      status={typeof sp.status === "string" ? sp.status : ""}
      sort={typeof sp.sort === "string" ? sp.sort : ""}
      dir={typeof sp.dir === "string" ? sp.dir : ""}
      page={typeof sp.page === "string" ? sp.page : ""}
    />
  );
}
