import { headers } from "next/headers";
import { DRAFTASTIC_MARKETING_LANDING_DOMAIN } from "@/lib/siteDomains";

/** Second path segment under `/wrestlers/` that is a feature route, not a wrestler slug. */
const WRESTLERS_FEATURE_SEGMENTS = new Set(["watch", "waiver", "added-dropped"]);

/**
 * True when this request is served on the marketing custom domain (draftasticprowrestling.com).
 * Use to hide fantasy/league UI while still rendering the same route tree as the hub app.
 */
export async function isMarketingHostRequest(): Promise<boolean> {
  const headersList = await headers();
  const forwarded = headersList.get("x-forwarded-host");
  const host = (forwarded?.split(",")[0]?.trim() || headersList.get("host") || "").toLowerCase();
  return host.includes(DRAFTASTIC_MARKETING_LANDING_DOMAIN);
}

/**
 * Pathnames allowed on the marketing domain. Everything else redirects to `/`.
 * Intentionally excludes `/api`, auth, fantasy, leagues, championship, wrestler tools, etc.
 */
export function isMarketingAllowedPathname(pathname: string): boolean {
  const path = pathname === "" ? "/" : pathname;

  if (path === "/") return true;
  if (path.startsWith("/_next")) return true;

  if (path === "/coming-soon" || path.startsWith("/coming-soon/")) return true;

  if (path === "/about-us" || path === "/about-us/") return true;

  if (path === "/news" || path === "/news/") return true;
  if (path.startsWith("/news/")) {
    const rest = path.slice("/news/".length);
    return rest.length > 0 && !rest.includes("/");
  }

  if (path === "/event-results" || path === "/event-results/") return true;
  if (path.startsWith("/event-results/")) {
    const rest = path.slice("/event-results/".length);
    return rest.length > 0 && !rest.includes("/");
  }

  if (path === "/wrestlers" || path === "/wrestlers/") return true;
  if (path.startsWith("/wrestlers/")) {
    const segments = path.split("/").filter(Boolean);
    if (segments.length !== 2) return false;
    const slug = segments[1];
    return Boolean(slug) && !WRESTLERS_FEATURE_SEGMENTS.has(slug);
  }

  return false;
}
