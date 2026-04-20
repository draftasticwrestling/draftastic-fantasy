import { DEFAULT_APP_HUB_ORIGIN } from "@/lib/siteDomains";

/**
 * Canonical public origin for absolute URLs (SEO, sitemap, Open Graph).
 * Set `NEXT_PUBLIC_SITE_URL` in production (e.g. https://draftasticprowrestling.com).
 */
export function getSitePublicOrigin(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) {
    return explicit.replace(/\/$/, "");
  }
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    const host = vercel.replace(/^https?:\/\//, "");
    return `https://${host}`;
  }
  return DEFAULT_APP_HUB_ORIGIN.replace(/\/$/, "");
}

export function absoluteUrl(path: string): string {
  const base = getSitePublicOrigin();
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}
