export const HOW_IT_WORKS_TAB_IDS = [
  "road-to-summerslam",
  "road-to-survivor-series",
  "road-to-wrestlemania",
  "legacy",
] as const;

export type HowItWorksTabId = (typeof HOW_IT_WORKS_TAB_IDS)[number];

export function isHowItWorksTabId(v: string | null | undefined): v is HowItWorksTabId {
  return v != null && HOW_IT_WORKS_TAB_IDS.includes(v as HowItWorksTabId);
}

export function parseHowItWorksTabParam(tab: string | string[] | undefined): HowItWorksTabId {
  const raw = Array.isArray(tab) ? tab[0] : tab;
  return isHowItWorksTabId(raw) ? raw : "road-to-summerslam";
}
