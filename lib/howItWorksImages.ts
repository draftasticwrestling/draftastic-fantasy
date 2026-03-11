/**
 * Image URLs for How It Works: belts (Title Points) and event logos (Raw/Smackdown, PLEs).
 *
 * - Wrestler images already come from Supabase (wrestlers.image_url) populated by Pro Wrestling Boxscore.
 * - Belts and event logos: either (1) add columns/tables in Supabase and populate from Boxscore, then
 *   load them in a server component and pass here (or merge into this map), or (2) use static assets
 *   in public/ and set paths below (e.g. "/belts/undisputed-wwe.png").
 *
 * If a key has no URL, the How It Works page shows the placeholder. Add URLs when you have them.
 * See docs/HOW_IT_WORKS_IMAGES.md for options.
 */

export type BeltKey =
  | "undisputed-wwe"
  | "heavyweight"
  | "wwe-womens"
  | "womens-world"
  | "intercontinental-mens"
  | "intercontinental-womens"
  | "us-mens"
  | "us-womens"
  | "tag-team-mens"
  | "tag-team-womens";

export type EventLogoKey =
  | "raw"
  | "smackdown"
  | "wrestlemania"
  | "summerslam"
  | "survivor-series"
  | "royal-rumble"
  | "elimination-chamber"
  | "night-of-champions"
  | "money-in-the-bank"
  | "crown-jewel"
  | "king-queen"
  | "saturday-nights-main-event"
  | "backlash"
  | "evolution"
  | "clash-in-paris"
  | "wrestlepalooza";

const BELTS_BASE =
  "https://qvbqxietcmweltxoonvh.supabase.co/storage/v1/object/public/belts";

/** Belt image URL by key. Empty = use placeholder. */
export const BELT_IMAGE_URLS: Partial<Record<BeltKey, string>> = {
  "undisputed-wwe": `${BELTS_BASE}/undisputed-wwe-championship.png`,
  heavyweight: `${BELTS_BASE}/world-heavyweight-championship.png`,
  "wwe-womens": `${BELTS_BASE}/wwe-womens-championship.png`,
  "womens-world": `${BELTS_BASE}/womens-world-championship.png`,
  "intercontinental-mens": `${BELTS_BASE}/mens-intercontinental-championship1.png`,
  "intercontinental-womens": `${BELTS_BASE}/womens-intercontinental-championship.png`,
  "us-mens": `${BELTS_BASE}/mens-united-states-championship.png`,
  "us-womens": `${BELTS_BASE}/womens-united-states-championship.png`,
  "tag-team-mens": `${BELTS_BASE}/raw-tag-team-championship.png`,
  "tag-team-womens": `${BELTS_BASE}/womens-tag-team-championship.png`,
};

/** Event logo URL by key. Empty = use placeholder. */
export const EVENT_LOGO_URLS: Partial<Record<EventLogoKey, string>> = {
  // Example: "raw": "/events/raw.png",
};
