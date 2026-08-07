"use client";

import { useRouteLoader } from "../RouteLoader";
import PhoneAuth from "./PhoneAuth.component";

/**
 * Thin wrapper around <PhoneAuth> for the standalone /login page — it's the
 * only caller that needs a full-page navigation on success (BookingFlow's
 * checkout-time usage just updates local state instead, see there).
 */
export default function LoginPageAuth({ next }: { next: string }) {
  const routeLoader = useRouteLoader();
  return <PhoneAuth onSuccess={() => routeLoader.navigate(next, "Signing you in…")} />;
}
