import { TicketScreen } from "@/screens";

export const dynamic = "force-dynamic";

export default async function Page({ params }: PageProps<"/ticket/[ticketId]">) {
  const { ticketId } = await params;
  return <TicketScreen ticketId={ticketId} />;
}
