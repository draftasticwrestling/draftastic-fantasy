import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const LANDING_DOMAIN = "draftasticprowrestling.com";

export async function middleware(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  const pathname = request.nextUrl.pathname;
  const isLandingDomain = host.toLowerCase().includes(LANDING_DOMAIN);

  if (isLandingDomain) {
    // Force HTTPS: if original request was HTTP, redirect to HTTPS (Netlify sends x-forwarded-proto)
    const proto = request.headers.get("x-forwarded-proto");
    if (proto === "http") {
      const host = request.headers.get("host") ?? "";
      const httpsUrl = `https://${host}${pathname}${request.nextUrl.search}`;
      return NextResponse.redirect(httpsUrl, 301);
    }

    // Only allow / and /coming-soon (rewritten from /). Redirect everything else to /
    if (pathname !== "/" && pathname !== "/coming-soon") {
      return NextResponse.redirect(new URL("/", request.url));
    }
    if (pathname === "/") {
      const res = NextResponse.rewrite(new URL("/coming-soon", request.url));
      // Ask the browser to upgrade any HTTP subresource requests to HTTPS (helps with mixed-content in Chrome)
      res.headers.set("Content-Security-Policy", "upgrade-insecure-requests");
      return res;
    }
    const res = await updateSession(request);
    res.headers.set("Content-Security-Policy", "upgrade-insecure-requests");
    return res;
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all paths except static files and images.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
