/**
 * Image URLs for How It Works: belts (Title Points) and event logos (Raw/Smackdown, PLEs).
 *
 * - Wrestler images already come from Supabase (wrestlers.image_url) populated by Pro Wrestling Boxscore.
 * - Championship belt PNGs: served from `public/images/belts/` (see BELT_IMAGE_URLS).
 * - Event logos: `public/images/event-logos/` (EVENT_LOGO_URLS below).
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
  | "tag-team-smackdown"
  | "tag-team-womens"
  | "nxt"
  | "nxt-womens"
  | "nxt-north-american"
  | "nxt-north-american-womens"
  | "nxt-tag-team"
  | "speed-mens"
  | "speed-womens";

export type EventLogoKey =
  | "raw"
  | "smackdown"
  | "nxt"
  | "aaa"
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

/** Same-origin belt art under `public/images/belts/` (no Supabase Storage egress). */
const BELTS_PUBLIC = "/images/belts";

/** Belt image URL by key. Empty = use placeholder. Crown Jewel belts omitted for now. */
export const BELT_IMAGE_URLS: Partial<Record<BeltKey, string>> = {
  "undisputed-wwe": `${BELTS_PUBLIC}/undisputed-wwe-championship.png`,
  heavyweight: `${BELTS_PUBLIC}/world-heavyweight-championship.png`,
  "wwe-womens": `${BELTS_PUBLIC}/womens-wwe-championship.png`,
  "womens-world": `${BELTS_PUBLIC}/womens-world-championship.png`,
  "intercontinental-mens": `${BELTS_PUBLIC}/mens-intercontinental-championship.png`,
  "intercontinental-womens": `${BELTS_PUBLIC}/womens-intercontinental-championship.png`,
  "us-mens": `${BELTS_PUBLIC}/mens-united-states-championship.png`,
  "us-womens": `${BELTS_PUBLIC}/womens-united-states-championship.png`,
  /** Men's tag (non–SmackDown-specific): Raw / world tag style belt. */
  "tag-team-mens": `${BELTS_PUBLIC}/raw-tag-team-championship.png`,
  "tag-team-smackdown": `${BELTS_PUBLIC}/smackdown-tag-team-championship.png`,
  "tag-team-womens": `${BELTS_PUBLIC}/womens-tag-team-championship.png`,
  nxt: `${BELTS_PUBLIC}/nxt-championship.png`,
  "nxt-womens": `${BELTS_PUBLIC}/nxt-womens-championship.png`,
  "nxt-north-american": `${BELTS_PUBLIC}/nxt-north-american-championship.png`,
  "nxt-north-american-womens": `${BELTS_PUBLIC}/nxt-north-american-womens-championship.png`,
  "nxt-tag-team": `${BELTS_PUBLIC}/nxt-tag-team-championship.png`,
  "speed-mens": `${BELTS_PUBLIC}/nxt-speed-championship.png`,
  "speed-womens": `${BELTS_PUBLIC}/nxt-womens-speed-championship.png`,
};

/** Same-origin event / brand marks under `public/images/event-logos/`. */
const EVENT_LOGOS_BASE = "/images/event-logos";

/** Event logo URL by key. Empty = use placeholder. Filenames match files in `public/images/event-logos/`. */
export const EVENT_LOGO_URLS: Partial<Record<EventLogoKey, string>> = {
  raw: `${EVENT_LOGOS_BASE}/Raw.png`,
  smackdown: `${EVENT_LOGOS_BASE}/Smackdown.png`,
  nxt: `${EVENT_LOGOS_BASE}/NXT.png`,
  aaa: `${EVENT_LOGOS_BASE}/AAA.png`,
  wrestlemania: `${EVENT_LOGOS_BASE}/WrestleMania-White.png`,
  summerslam: `${EVENT_LOGOS_BASE}/Summer-Slam.png`,
  "survivor-series": `${EVENT_LOGOS_BASE}/Survivor-Series.png`,
  "royal-rumble": `${EVENT_LOGOS_BASE}/Royal-Rumble.png`,
  "elimination-chamber": `${EVENT_LOGOS_BASE}/Elimination-Chamber.png`,
  "night-of-champions": `${EVENT_LOGOS_BASE}/Night-Of-Champions.png`,
  "money-in-the-bank": `${EVENT_LOGOS_BASE}/Money-In-The-Bank.png`,
  "crown-jewel": `${EVENT_LOGOS_BASE}/Crown-Jewel.png`,
  "king-queen": `${EVENT_LOGOS_BASE}/King-And-Queen-Of-The-Ring.png`,
  "saturday-nights-main-event": `${EVENT_LOGOS_BASE}/Saturday-Nights-Main-Event.png`,
  backlash: `${EVENT_LOGOS_BASE}/Backlash.png`,
  evolution: `${EVENT_LOGOS_BASE}/Evolution.png`,
  "clash-in-paris": `${EVENT_LOGOS_BASE}/clash-in-paris.png`,
  wrestlepalooza: `${EVENT_LOGOS_BASE}/Wrestlepalooza.png`,
};

/** WWE 2K mark on roster trading cards (not an EventLogoKey). */
export const WWE_2K_CARD_LOGO_SRC = `${EVENT_LOGOS_BASE}/2K26.png`;

/** Map event type (from eventClassifier) to EventLogoKey for EVENT_LOGO_URLS. */
export function eventTypeToLogoKey(eventType: string): EventLogoKey | null {
  const t = (eventType || "").toLowerCase().trim();
  if (t === "raw") return "raw";
  if (t === "smackdown") return "smackdown";
  if (t.startsWith("wrestlemania")) return "wrestlemania";
  if (t.startsWith("summerslam")) return "summerslam";
  if (t === "survivor-series") return "survivor-series";
  if (t === "royal-rumble") return "royal-rumble";
  if (t === "elimination-chamber") return "elimination-chamber";
  if (t === "night-of-champions") return "night-of-champions";
  if (t === "king-queen-of-the-ring") return "king-queen";
  if (t === "money-in-the-bank") return "money-in-the-bank";
  if (t === "saturday-nights-main-event") return "saturday-nights-main-event";
  if (t === "backlash") return "backlash";
  if (t === "evolution") return "evolution";
  if (t === "clash-in-paris") return "clash-in-paris";
  if (t === "wrestlepalooza") return "wrestlepalooza";
  if (t === "crown-jewel") return "crown-jewel";
  return null;
}

/** Get event logo URL from event type (from classifyEventType). Returns undefined if no logo. */
export function getEventLogoUrl(eventType: string): string | undefined {
  const key = eventTypeToLogoKey(eventType);
  return key ? EVENT_LOGO_URLS[key] : undefined;
}
