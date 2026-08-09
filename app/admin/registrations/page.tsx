import { AdminRegistrationsScreen } from "@/screens";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: PageProps<"/admin/registrations">) {
  const sp = await searchParams;
  return (
    <AdminRegistrationsScreen
      q={typeof sp.q === "string" ? sp.q : ""}
      eventId={typeof sp.eventId === "string" ? sp.eventId : ""}
      sort={typeof sp.sort === "string" ? sp.sort : ""}
      dir={typeof sp.dir === "string" ? sp.dir : ""}
      page={typeof sp.page === "string" ? sp.page : ""}
    />
  );
}
