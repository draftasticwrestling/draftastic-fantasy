import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const LANDING_DOMAIN = "draftasticprowrestling.com";

export async function middleware(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  const pathname = request.nextUrl.pathname;
  const isLandingDomain = host.toLowerCase().includes(LANDING_DOMAIN);

  if (isLandingDomain) {
    // Only allow / and /coming-soon (rewritten from /). Redirect everything else to /
    if (pathname !== "/" && pathname !== "/coming-soon") {
      return NextResponse.redirect(new URL("/", request.url));
    }
    if (pathname === "/") {
      return NextResponse.rewrite(new URL("/coming-soon", request.url));
    }
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
