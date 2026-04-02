/** Public path for the gold belt mark. Bump `SITE_LOGO_VERSION` after replacing the PNG so browsers refetch. */
export const SITE_LOGO_PATH = "/draftastic-gold.png";
export const SITE_LOGO_VERSION = "5";

export function siteLogoHref(): string {
  return `${SITE_LOGO_PATH}?v=${SITE_LOGO_VERSION}`;
}
