import { AdminEventCreateScreen } from "@/screens";

export const dynamic = "force-dynamic";
export const metadata = { title: "Create event — Utsav Events Admin" };

export default async function Page({ searchParams }: PageProps<"/admin/events/new">) {
  const sp = await searchParams;
  const cloneFrom = typeof sp.cloneFrom === "string" ? sp.cloneFrom : undefined;
  return <AdminEventCreateScreen cloneFrom={cloneFrom} />;
}
