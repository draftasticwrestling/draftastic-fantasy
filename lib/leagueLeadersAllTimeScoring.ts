import type { SupabaseClient } from "@supabase/supabase-js";
import { aggregateWrestlerPoints } from "@/lib/scoring/aggregateWrestlerPoints.js";
import { aggregateWrestlerMatchStats } from "@/lib/scoring/aggregateWrestlerMatchStats.js";
import {
  mergeGetMonthlyBeltForWrestler,
  mergeGetPointsForWrestler,
} from "@/lib/scoring/draftAliasListMerge";
import { computeHybridPublicBeltHoldBySlug, inferReignsFromEvents, mergeReigns } from "@/lib/scoring/endOfMonthBeltPoints.js";
import { EVENT_STATUSES_FOR_SCORING } from "@/lib/eventsScoring";
import { classifyEventType, EVENT_TYPES } from "@/lib/scoring/parsers/eventClassifier.js";
import { brandByWrestlerSlugFromRows } from "@/lib/wrestlerBrandLookup";

/** Events window for League Leaders “all-time” scoring (matches league-leaders page). */
export const LEAGUE_LEADERS_ALL_TIME_EVENTS_FROM = "2020-01-01";
export const LEAGUE_LEADERS_ALL_TIME_EVENTS_LIMIT = 3000;
/** First week-ending Sunday for weekly title-hold points in the all-time column (matches league-leaders page). */
export const LEAGUE_LEADERS_ALL_TIME_FIRST_WEEK_END_SUNDAY = "2026-04-26";

/** @deprecated Use `LEAGUE_LEADERS_ALL_TIME_FIRST_WEEK_END_SUNDAY`. */
export const LEAGUE_LEADERS_ALL_TIME_FIRST_MONTH_END = LEAGUE_LEADERS_ALL_TIME_FIRST_WEEK_END_SUNDAY;

export type LeagueLeadersAllTimeScoringBundle = {
  pointsAllTimeBySlug: ReturnType<typeof aggregateWrestlerPoints>;
  /** Same aggregate but Raw/SmackDown/NXT weekly shows only — excludes standalone `nxt-*` event types (NXT footnotes). */
  pointsAllTimeMainOnlyBySlug: ReturnType<typeof aggregateWrestlerPoints>;
  /** Calendar-year slices from the same events query — used when wrestler_stats_cache fails integrity checks. */
  points2025BySlug: ReturnType<typeof aggregateWrestlerPoints>;
  points2025MainOnlyBySlug: ReturnType<typeof aggregateWrestlerPoints>;
  points2026BySlug: ReturnType<typeof aggregateWrestlerPoints>;
  points2026MainOnlyBySlug: ReturnType<typeof aggregateWrestlerPoints>;
  endOfMonthBeltPointsAllTime: Record<string, number>;
  matchStatsAllTimeBySlug: ReturnType<typeof aggregateWrestlerMatchStats>;
  matchStatsAllTimeMainOnlyBySlug: ReturnType<typeof aggregateWrestlerMatchStats>;
  matchStats2025BySlug: ReturnType<typeof aggregateWrestlerMatchStats>;
  matchStats2025MainOnlyBySlug: ReturnType<typeof aggregateWrestlerMatchStats>;
  matchStats2026BySlug: ReturnType<typeof aggregateWrestlerMatchStats>;
  matchStats2026MainOnlyBySlug: ReturnType<typeof aggregateWrestlerMatchStats>;
};

type EventRow = { id: string; name: string; date: string; matches?: object[] };

function isNxtStandaloneEventType(eventType: string): boolean {
  return eventType === EVENT_TYPES.NXT || eventType.startsWith("nxt-");
}

/**
 * Live all-time aggregates for League Leaders / Free Agents (do not use wrestler_stats_cache).
 * Full events window + reign merge + hybrid belt hold map.
 */
export async function loadLeagueLeadersAllTimeScoringBundle(
  db: Pick<SupabaseClient, "from">
): Promise<LeagueLeadersAllTimeScoringBundle> {
  const [{ data: rawReigns }, { data: allEventsData }, { data: brandRows }] = await Promise.all([
    db.from("championship_history").select("*"),
    db
      .from("events")
      .select("id, name, date, matches")
      .in("status", [...EVENT_STATUSES_FOR_SCORING])
      .gte("date", LEAGUE_LEADERS_ALL_TIME_EVENTS_FROM)
      .order("date", { ascending: true })
      .limit(LEAGUE_LEADERS_ALL_TIME_EVENTS_LIMIT),
    db.from("wrestlers").select("id, brand"),
  ]);
  const eventsAll = (allEventsData ?? []) as EventRow[];
  const brandMap = brandByWrestlerSlugFromRows((brandRows ?? []) as { id: string; brand: string | null }[]);
  const mainOnlyEvents = eventsAll.filter((e) => {
    const t = classifyEventType(e.name ?? "", e.id ?? "");
    return !isNxtStandaloneEventType(t);
  });
  const events2025 = eventsAll.filter((e) => {
    const d = (e.date ?? "").toString().slice(0, 10);
    return d >= "2025-01-01" && d <= "2025-12-31";
  });
  const events2026 = eventsAll.filter((e) => {
    const d = (e.date ?? "").toString().slice(0, 10);
    return d >= "2026-01-01" && d <= "2026-12-31";
  });
  const events2025MainOnly = events2025.filter((e) => {
    const t = classifyEventType(e.name ?? "", e.id ?? "");
    return !isNxtStandaloneEventType(t);
  });
  const events2026MainOnly = events2026.filter((e) => {
    const t = classifyEventType(e.name ?? "", e.id ?? "");
    return !isNxtStandaloneEventType(t);
  });
  const tableReigns = (rawReigns ?? []) as Parameters<typeof mergeReigns>[0];
  const inferredReigns = inferReignsFromEvents(eventsAll);
  const reigns = mergeReigns(tableReigns, inferredReigns);
  const pointsAllTimeBySlug = aggregateWrestlerPoints(eventsAll, brandMap);
  const pointsAllTimeMainOnlyBySlug = aggregateWrestlerPoints(mainOnlyEvents, brandMap);
  const points2025BySlug = aggregateWrestlerPoints(events2025, brandMap);
  const points2025MainOnlyBySlug = aggregateWrestlerPoints(events2025MainOnly, brandMap);
  const points2026BySlug = aggregateWrestlerPoints(events2026, brandMap);
  const points2026MainOnlyBySlug = aggregateWrestlerPoints(events2026MainOnly, brandMap);
  const endOfMonthBeltPointsAllTime = computeHybridPublicBeltHoldBySlug(reigns);
  const matchStatsAllTimeBySlug = aggregateWrestlerMatchStats(eventsAll);
  const matchStatsAllTimeMainOnlyBySlug = aggregateWrestlerMatchStats(mainOnlyEvents);
  const matchStats2025BySlug = aggregateWrestlerMatchStats(events2025);
  const matchStats2025MainOnlyBySlug = aggregateWrestlerMatchStats(events2025MainOnly);
  const matchStats2026BySlug = aggregateWrestlerMatchStats(events2026);
  const matchStats2026MainOnlyBySlug = aggregateWrestlerMatchStats(events2026MainOnly);
  return {
    pointsAllTimeBySlug,
    pointsAllTimeMainOnlyBySlug,
    points2025BySlug,
    points2025MainOnlyBySlug,
    points2026BySlug,
    points2026MainOnlyBySlug,
    endOfMonthBeltPointsAllTime,
    matchStatsAllTimeBySlug,
    matchStatsAllTimeMainOnlyBySlug,
    matchStats2025BySlug,
    matchStats2025MainOnlyBySlug,
    matchStats2026BySlug,
    matchStats2026MainOnlyBySlug,
  };
}

/** RS + PLE + (event belt + monthly hold belt) — same formula as League Leaders all-time (non-cache). */
function finiteNum(n: number): number {
  return Number.isFinite(n) ? n : 0;
}

export function allTimeLeadersStylePointBreakdown(
  pointsBySlug: LeagueLeadersAllTimeScoringBundle["pointsAllTimeBySlug"],
  endOfMonthBeltPointsAllTime: Record<string, number>,
  slugKey: string,
  nameKey: string
): { rs: number; ple: number; beltCombined: number; total: number } {
  const p = mergeGetPointsForWrestler(pointsBySlug, slugKey, nameKey);
  const rs = finiteNum(p.rsPoints);
  const ple = finiteNum(p.plePoints);
  const beltBase = finiteNum(p.beltPoints);
  const extraBelt = finiteNum(
    mergeGetMonthlyBeltForWrestler(endOfMonthBeltPointsAllTime, slugKey, nameKey)
  );
  const beltCombined = beltBase + extraBelt;
  return { rs, ple, beltCombined, total: rs + ple + beltCombined };
}

export function allTimeFantasyTotalLeagueLeadersStyle(
  pointsBySlug: LeagueLeadersAllTimeScoringBundle["pointsAllTimeBySlug"],
  endOfMonthBeltPointsAllTime: Record<string, number>,
  slugKey: string,
  nameKey: string
): number {
  return allTimeLeadersStylePointBreakdown(pointsBySlug, endOfMonthBeltPointsAllTime, slugKey, nameKey).total;
}
