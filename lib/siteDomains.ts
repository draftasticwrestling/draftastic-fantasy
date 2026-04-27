/** Hostname fragment for draftasticprowrestling.com (HTTPS upgrade in middleware; same app as other public hosts). */
export const DRAFTASTIC_MARKETING_LANDING_DOMAIN = "draftasticprowrestling.com";

/** Canonical HTTPS origin for the live site (SEO, sitemap, Open Graph). Prefer `NEXT_PUBLIC_SITE_URL` in env when overriding. */
export const DRAFTASTIC_PUBLIC_SITE_ORIGIN = `https://${DRAFTASTIC_MARKETING_LANDING_DOMAIN}`;

/** Alias kept for legacy imports; matches the marketing domain. */
export const DEFAULT_APP_HUB_ORIGIN = DRAFTASTIC_PUBLIC_SITE_ORIGIN;
