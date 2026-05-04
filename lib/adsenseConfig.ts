/**
 * Google AdSense / Search Console helpers.
 *
 * Checklist:
 * - Root layout loads `adsbygoogle.js` in production (or when NEXT_PUBLIC_ADSENSE_DEV=1).
 * - `/ads.txt` is a static file under `public/ads.txt` (reliable on Netlify; update if publisher id changes).
 * - `robots.ts` allows Mediapartners-Google on public paths.
 * - Set NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION for Search Console HTML tag method.
 * - Create display ad units in AdSense, then set NEXT_PUBLIC_ADSENSE_SLOT_* on the host.
 */

/** Full client id as used in `?client=` and `data-ad-client` (e.g. ca-pub-…). */
export function getAdsenseClientCa(): string {
  return (process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID ?? "ca-pub-8084818325632971").trim();
}

export function isAdsenseScriptEnabled(): boolean {
  if (process.env.NEXT_PUBLIC_ADSENSE_DISABLE === "1") return false;
  if (process.env.NODE_ENV === "production") return true;
  return process.env.NEXT_PUBLIC_ADSENSE_DEV === "1";
}

export function getAdsenseSlotHubHome(): string {
  return (process.env.NEXT_PUBLIC_ADSENSE_SLOT_HUB_HOME ?? "").trim();
}

export function getAdsenseSlotFantasy(): string {
  return (process.env.NEXT_PUBLIC_ADSENSE_SLOT_FANTASY ?? "").trim();
}
