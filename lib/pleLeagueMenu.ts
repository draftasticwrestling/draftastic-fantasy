import { ROAD_TO_SUMMERSLAM_SEASON_SLUG } from "@/lib/leagueStructure";

/** URL segment under `/leagues/[slug]/ple/…` (not including legacy `wrestlemania`). */
export type PleNavEntry =
  | { kind: "rts"; pathKey: string; label: string }
  | { kind: "wrestlemania"; label: string };

export const RTS_2026_PLE_PATH_KEYS = [
  "backlash",
  "snme-1",
  "clash-in-italy",
  "night-of-champions",
  "snme-2",
  "summerslam",
] as const;

export type RtsPlePathKey = (typeof RTS_2026_PLE_PATH_KEYS)[number];

const RTS_2026_PLE_NAV: readonly PleNavEntry[] = [
  { kind: "rts", pathKey: "backlash", label: "Backlash" },
  { kind: "rts", pathKey: "snme-1", label: "SNME 1" },
  { kind: "rts", pathKey: "clash-in-italy", label: "Clash in Italy" },
  { kind: "rts", pathKey: "night-of-champions", label: "Night of Champions" },
  { kind: "rts", pathKey: "snme-2", label: "SNME 2" },
  { kind: "rts", pathKey: "summerslam", label: "SummerSlam" },
] as const;

/** WrestleMania projection page (Road to WrestleMania and legacy). */
const WRESTLEMANIA_ONLY: readonly PleNavEntry[] = [{ kind: "wrestlemania", label: "WrestleMania" }];

export function pleNavEntriesForSeasonSlug(seasonSlug: string | null | undefined): PleNavEntry[] {
  if (seasonSlug === ROAD_TO_SUMMERSLAM_SEASON_SLUG) return [...RTS_2026_PLE_NAV];
  if (seasonSlug === "road-to-wrestlemania") return [...WRESTLEMANIA_ONLY];
  return [...WRESTLEMANIA_ONLY];
}

function pleEntryIntersectsLeagueWindow(
  entry: PleNavEntry,
  leagueStart: string | null | undefined,
  leagueEnd: string | null | undefined
): boolean {
  if (entry.kind !== "rts") return true;
  const start = String(leagueStart ?? "").slice(0, 10);
  const end = String(leagueEnd ?? "").slice(0, 10);
  if (!start || !end) return true;
  const dates = rtsPleDatesForPathKey(entry.pathKey);
  return dates.some((d) => d >= start && d <= end);
}

export function pleNavEntriesForLeagueWindow(
  seasonSlug: string | null | undefined,
  leagueStart: string | null | undefined,
  leagueEnd: string | null | undefined
): PleNavEntry[] {
  return pleNavEntriesForSeasonSlug(seasonSlug).filter((entry) =>
    pleEntryIntersectsLeagueWindow(entry, leagueStart, leagueEnd)
  );
}

export function pleHrefForEntry(leagueSlug: string, entry: PleNavEntry): string {
  if (entry.kind === "wrestlemania") {
    return `/leagues/${encodeURIComponent(leagueSlug)}/ple/wrestlemania`;
  }
  return `/leagues/${encodeURIComponent(leagueSlug)}/ple/${encodeURIComponent(entry.pathKey)}`;
}

export function pleDefaultHref(
  leagueSlug: string,
  seasonSlug: string | null | undefined,
  leagueStart?: string | null,
  leagueEnd?: string | null
): string {
  const items = pleNavEntriesForLeagueWindow(seasonSlug, leagueStart, leagueEnd);
  if (items.length === 0) return `/leagues/${encodeURIComponent(leagueSlug)}`;
  if (seasonSlug !== ROAD_TO_SUMMERSLAM_SEASON_SLUG) {
    return pleHrefForEntry(leagueSlug, items[0]!);
  }

  const today = new Date().toISOString().slice(0, 10);
  const rtsItems = items.filter((e): e is { kind: "rts"; pathKey: string; label: string } => e.kind === "rts");
  const nextUpcoming = rtsItems.find((entry) => {
    const dates = rtsPleDatesForPathKey(entry.pathKey);
    const lastDate = dates[dates.length - 1] ?? "";
    return lastDate >= today;
  });
  return pleHrefForEntry(leagueSlug, nextUpcoming ?? rtsItems[rtsItems.length - 1] ?? items[0]!);
}

export function isRtsPlePathKey(key: string): key is RtsPlePathKey {
  return (RTS_2026_PLE_PATH_KEYS as readonly string[]).includes(key);
}

/** Calendar dates (YYYY-MM-DD) for each RTS PLE slot; SummerSlam is both nights. */
export function rtsPleDatesForPathKey(pathKey: string): string[] {
  switch (pathKey) {
    case "backlash":
      return ["2026-05-09"];
    case "snme-1":
      return ["2026-05-23"];
    case "clash-in-italy":
      return ["2026-05-31"];
    case "night-of-champions":
      return ["2026-06-27"];
    case "snme-2":
      return ["2026-07-18"];
    case "summerslam":
      return ["2026-08-01", "2026-08-02"];
    default:
      return [];
  }
}

export function rtsPleDisplayTitle(pathKey: string): string {
  const entry = RTS_2026_PLE_NAV.find((e) => e.kind === "rts" && e.pathKey === pathKey);
  return entry?.kind === "rts" ? entry.label : "PLE";
}
