import { BookingScreen } from "@/screens";

export const dynamic = "force-dynamic";

export default async function Page({ params }: PageProps<"/events/[id]/book">) {
  const { id } = await params;
  return <BookingScreen id={id} />;
}
