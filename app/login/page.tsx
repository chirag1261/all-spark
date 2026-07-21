import { redirect } from "next/navigation";

import { getCurrentCustomer, sanitizeNextPath } from "@/lib/auth/customer";
import { LoginScreen } from "@/screens";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = sanitizeNextPath(typeof sp.next === "string" ? sp.next : "/");

  // Already signed in? Straight through.
  if (await getCurrentCustomer()) redirect(next);

  return <LoginScreen next={next} />;
}
