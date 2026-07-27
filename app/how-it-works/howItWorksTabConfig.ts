/**
 * How it Works tab order.
 * - Public League is always first.
 * - Private season tabs follow upcoming / current season priority (not calendar order).
 *   Current: Road to War Games (active create season) → Road to WrestleMania (next) →
 *   Road to SummerSlam (winding down; returns post-WrestleMania 2027).
 * Update this array when the active private season changes.
 */
export const HOW_IT_WORKS_TAB_IDS = [
  "public-league",
  "road-to-war-games",
  "road-to-wrestlemania",
  "road-to-summerslam",
] as const;

export type HowItWorksTabId = (typeof HOW_IT_WORKS_TAB_IDS)[number];

const LEGACY_TAB_ALIASES: Record<string, HowItWorksTabId> = {
  "road-to-survivor-series": "road-to-war-games",
  legacy: "public-league",
};

export function isHowItWorksTabId(v: string | null | undefined): v is HowItWorksTabId {
  return v != null && HOW_IT_WORKS_TAB_IDS.includes(v as HowItWorksTabId);
}

export function parseHowItWorksTabParam(tab: string | string[] | undefined): HowItWorksTabId {
  const raw = Array.isArray(tab) ? tab[0] : tab;
  if (raw && LEGACY_TAB_ALIASES[raw]) return LEGACY_TAB_ALIASES[raw];
  return isHowItWorksTabId(raw) ? raw : "public-league";
}
