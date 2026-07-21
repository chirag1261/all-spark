import { EventDetailScreen } from "@/screens";

export const dynamic = "force-dynamic";

export default async function Page({ params }: PageProps<"/events/[id]">) {
  const { id } = await params;
  return <EventDetailScreen id={id} />;
}
