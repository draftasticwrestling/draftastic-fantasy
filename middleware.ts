import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const LANDING_DOMAIN = "draftasticprowrestling.com";

export async function middleware(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  const isLandingDomain = host.toLowerCase().includes(LANDING_DOMAIN);

  if (isLandingDomain) {
    const proto = request.headers.get("x-forwarded-proto");
    if (proto === "http") {
      const h = request.headers.get("host") ?? "";
      const httpsUrl = `https://${h}${request.nextUrl.pathname}${request.nextUrl.search}`;
      return NextResponse.redirect(httpsUrl, 301);
    }
    const res = await updateSession(request);
    res.headers.set("Content-Security-Policy", "upgrade-insecure-requests");
    return res;
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
