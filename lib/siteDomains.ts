/** Custom domain: `/` shows the coming-soon landing (middleware rewrites internally to `/coming-soon`). */
export const DRAFTASTIC_MARKETING_LANDING_DOMAIN = "draftasticprowrestling.com";

/**
 * Default public hub URL (results / news home) when the user is on the marketing domain.
 * Override with NEXT_PUBLIC_APP_HUB_ORIGIN if the hub moves (e.g. custom domain on Netlify).
 */
export const DEFAULT_APP_HUB_ORIGIN = "https://draftastic-fantasy.netlify.app";
