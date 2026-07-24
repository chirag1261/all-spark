import { AdminPromoCodeCreateScreen } from "@/screens";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: PageProps<"/admin/promocodes/new">) {
  const sp = await searchParams;
  const cloneFrom = typeof sp.cloneFrom === "string" ? sp.cloneFrom : undefined;
  return <AdminPromoCodeCreateScreen cloneFrom={cloneFrom} />;
}
