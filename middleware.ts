import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { oauthLandingNextFromRequestUrl } from "@/lib/auth/oauthCallbackNext";
import { updateSession } from "@/lib/supabase/middleware";
import { DRAFTASTIC_MARKETING_LANDING_DOMAIN } from "@/lib/siteDomains";

function shouldEnforceRequiredAccount(pathname: string): boolean {
  if (pathname.startsWith("/api/")) return false;
  if (pathname.startsWith("/auth/")) return false;
  if (pathname === "/account") return false;
  if (pathname === "/terms" || pathname === "/privacy") return false;
  return pathname.startsWith("/leagues") || pathname.startsWith("/internal-admin") || pathname.startsWith("/fantasy");
}

export async function middleware(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  const isMarketingDomain = host.toLowerCase().includes(DRAFTASTIC_MARKETING_LANDING_DOMAIN);
  const path = request.nextUrl.pathname;
  const authCode = request.nextUrl.searchParams.get("code");

  // Some auth providers/callback configs can land on arbitrary routes with ?code=...
  // Route those through /auth/callback so the code is exchanged and removed from the URL.
  if (authCode && path !== "/auth/callback") {
    const callbackUrl = request.nextUrl.clone();
    callbackUrl.pathname = "/auth/callback";
    if (!callbackUrl.searchParams.get("next")) {
      callbackUrl.searchParams.set("next", oauthLandingNextFromRequestUrl(request.nextUrl));
    }
    return NextResponse.redirect(callbackUrl);
  }

  if (isMarketingDomain) {
    const proto = request.headers.get("x-forwarded-proto");
    if (proto === "http") {
      const h = request.headers.get("host") ?? "";
      const httpsUrl = `https://${h}${path}${request.nextUrl.search}`;
      return NextResponse.redirect(httpsUrl, 301);
    }
  }

  const sessionRes = await updateSession(request);

  if (shouldEnforceRequiredAccount(path)) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
    if (url && key) {
      try {
        const supabase = createServerClient(url, key, {
          cookies: {
            getAll() {
              return request.cookies.getAll();
            },
            setAll() {
              // no-op in middleware guard read path
            },
          },
        });
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("display_name, accepted_terms_at, accepted_privacy_at, timezone, is_suspended, suspended_until")
            .eq("id", user.id)
            .maybeSingle();
          const suspendedUntilRaw =
            (profile as { suspended_until?: string | null } | null)?.suspended_until ?? null;
          const suspendedUntilMs = suspendedUntilRaw ? Date.parse(suspendedUntilRaw) : Number.NaN;
          const suspensionStillActive =
            Boolean((profile as { is_suspended?: boolean | null } | null)?.is_suspended) &&
            (!suspendedUntilRaw || Number.isNaN(suspendedUntilMs) || suspendedUntilMs > Date.now());
          if (suspensionStillActive) {
            const to = new URL("/account", request.url);
            to.searchParams.set("suspended", "1");
            to.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
            return NextResponse.redirect(to);
          }
          const displayName = (profile?.display_name ?? "").trim();
          const timezone = ((profile as { timezone?: string | null } | null)?.timezone ?? "").trim();
          const hasRequired =
            displayName.length > 0 &&
            Boolean(profile?.accepted_terms_at) &&
            Boolean(profile?.accepted_privacy_at) &&
            timezone.length > 0;
          if (!hasRequired) {
            const to = new URL("/account", request.url);
            to.searchParams.set("required", "1");
            to.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
            return NextResponse.redirect(to);
          }
        }
      } catch {
        // Best effort gate; fail open if middleware query fails.
      }
    }
  }

  if (isMarketingDomain) {
    sessionRes.headers.set("Content-Security-Policy", "upgrade-insecure-requests");
  }

  return sessionRes;
}

export const config = {
  matcher: [
    "/",
    "/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
