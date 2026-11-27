/**
 * Shared SEO copy and asset paths for root metadata, Open Graph, and JSON-LD.
 * Canonical host comes from `getSitePublicOrigin()` / `NEXT_PUBLIC_SITE_URL`.
 */

export const SEO_SITE_NAME = "Draftastic Pro Wrestling";

/** Default meta description (keep ~150–160 chars for SERP snippets). */
export const SEO_DEFAULT_DESCRIPTION =
  "Fantasy pro wrestling leagues, WWE and NXT results, scoring, championship history, and news — Draftastic.";

export const SEO_DEFAULT_KEYWORDS = [
  "fantasy pro wrestling",
  "pro wrestling",
  "WWE",
  "NXT",
  "fantasy wrestling",
  "wrestling results",
  "wrestling event results",
  "wrestling scores",
  "Draftastic",
] as const;

/** Public path under `/public` for default social preview image. */
export const SEO_DEFAULT_OG_IMAGE_PATH = "/draftastic-main.png";
