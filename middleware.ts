import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { DRAFTASTIC_MARKETING_LANDING_DOMAIN } from "@/lib/siteDomains";

export async function middleware(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  const isMarketingDomain = host.toLowerCase().includes(DRAFTASTIC_MARKETING_LANDING_DOMAIN);

  if (isMarketingDomain) {
    const proto = request.headers.get("x-forwarded-proto");
    if (proto === "http") {
      const h = request.headers.get("host") ?? "";
      const httpsUrl = `https://${h}${request.nextUrl.pathname}${request.nextUrl.search}`;
      return NextResponse.redirect(httpsUrl, 301);
    }
  }

  const sessionRes = await updateSession(request);

  if (isMarketingDomain) {
    sessionRes.headers.set("Content-Security-Policy", "upgrade-insecure-requests");
    const path = request.nextUrl.pathname;
    if (path === "/" || path === "") {
      const rewrite = NextResponse.rewrite(new URL("/fantasy", request.url));
      sessionRes.cookies.getAll().forEach((c) => {
        rewrite.cookies.set(c.name, c.value);
      });
      rewrite.headers.set("Content-Security-Policy", "upgrade-insecure-requests");
      return rewrite;
    }
  }

  return sessionRes;
}

export const config = {
  matcher: [
    "/",
    "/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
