/** Custom domain that should show the fantasy marketing landing at `/` (rewritten to `/fantasy` in middleware). */
export const DRAFTASTIC_MARKETING_LANDING_DOMAIN = "draftasticprowrestling.com";

/**
 * Default public hub URL (results / news home) when the user is on the marketing domain.
 * Override with NEXT_PUBLIC_APP_HUB_ORIGIN if the hub moves (e.g. custom domain on Netlify).
 */
export const DEFAULT_APP_HUB_ORIGIN = "https://draftastic-fantasy.netlify.app";
