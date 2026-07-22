import { AdminLoginScreen } from "@/screens";

// Reads the ?reason=idle query param on the client (useSearchParams), so this
// route can't be statically prerendered.
export const dynamic = "force-dynamic";

export default function Page() {
  return <AdminLoginScreen />;
}
