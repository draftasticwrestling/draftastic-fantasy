import { DRAFTASTIC_PUBLIC_SITE_ORIGIN } from "@/lib/siteDomains";

/**
 * Origin for copied and emailed league invite links.
 * Production always uses the public site so a Netlify default domain stored in
 * NEXT_PUBLIC_APP_URL is not what managers receive.
 */
export function leagueInviteOrigin(): string {
  if (process.env.NODE_ENV !== "production") {
    const local = process.env.NEXT_PUBLIC_APP_URL?.trim();
    if (local) return local.replace(/\/$/, "");
    return "http://localhost:3000";
  }
  return DRAFTASTIC_PUBLIC_SITE_ORIGIN;
}

/**
 * Canonical public origin for absolute URLs (SEO, sitemap, Open Graph).
 *
 * Prefer `NEXT_PUBLIC_SITE_URL` in env (e.g. https://draftasticprowrestling.com).
 *
 * On **Netlify**, builds receive `URL` (primary site URL). Without an explicit site URL,
 * using a wrong host in the sitemap (e.g. an old default domain) causes Search Console to
 * flag every URL. Optional Vercel vars are supported for contributors who deploy there.
 */
export function getSitePublicOrigin(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) {
    return explicit.replace(/\/$/, "");
  }
  // Netlify: primary URL for this deploy (production custom domain or preview permalink).
  const netlifyUrl = process.env.URL?.trim();
  if (netlifyUrl) {
    try {
      return new URL(netlifyUrl).origin;
    } catch {
      /* fall through */
    }
  }
  // Vercel production: avoid *.vercel.app in sitemap when env override is unset.
  if (process.env.VERCEL_ENV === "production") {
    return DRAFTASTIC_PUBLIC_SITE_ORIGIN.replace(/\/$/, "");
  }
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    const host = vercel.replace(/^https?:\/\//, "");
    return `https://${host}`;
  }
  return DRAFTASTIC_PUBLIC_SITE_ORIGIN.replace(/\/$/, "");
}

export function absoluteUrl(path: string): string {
  const base = getSitePublicOrigin();
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}
