import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const LANDING_DOMAIN = "draftasticprowrestling.com";

export async function middleware(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  const pathname = request.nextUrl.pathname;

  // Serve coming-soon landing at / when the request is for the landing domain
  if (host.toLowerCase().includes(LANDING_DOMAIN) && pathname === "/") {
    return NextResponse.rewrite(new URL("/coming-soon", request.url));
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
