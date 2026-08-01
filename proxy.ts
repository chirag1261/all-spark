import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Belt-and-braces canonical-domain redirect: www.utsavevents.live ->
 * utsavevents.live. Cloudflare/Railway should already handle this at the DNS
 * layer, but every URL the app itself generates (metadataBase, ticket links,
 * event links) already assumes the bare domain — this guarantees a visitor
 * who lands on www never sees a broken session/duplicate origin even if that
 * external redirect config drifts or isn't set up yet.
 */
export function proxy(request: NextRequest) {
  if (request.nextUrl.hostname === "www.utsavevents.live") {
    const url = request.nextUrl.clone();
    url.protocol = "https";
    url.hostname = "utsavevents.live";
    url.port = "";
    return NextResponse.redirect(url, 308);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Skip static assets/build internals — this only needs to run on actual
    // page/API navigations, not every _next/static chunk request.
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|icon.png).*)",
  ],
};
