import type { SupabaseClient } from "@supabase/supabase-js";
import { aggregateWrestlerPoints, getPointsForWrestler } from "@/lib/scoring/aggregateWrestlerPoints.js";
import {
  computeEndOfMonthBeltPoints,
  getMonthlyBeltForWrestler,
  inferReignsFromEvents,
  mergeReigns,
} from "@/lib/scoring/endOfMonthBeltPoints.js";
import { EVENT_STATUSES_FOR_SCORING } from "@/lib/eventsScoring";

/** Events window for League Leaders “all-time” scoring (matches league-leaders page). */
export const LEAGUE_LEADERS_ALL_TIME_EVENTS_FROM = "2020-01-01";
export const LEAGUE_LEADERS_ALL_TIME_EVENTS_LIMIT = 10000;
/** First month-end for monthly title-hold points in the all-time column (matches league-leaders page). */
export const LEAGUE_LEADERS_ALL_TIME_FIRST_MONTH_END = "2025-01-31";

export type LeagueLeadersAllTimeScoringBundle = {
  pointsAllTimeBySlug: ReturnType<typeof aggregateWrestlerPoints>;
  endOfMonthBeltPointsAllTime: Record<string, number>;
};

type EventRow = { id: string; name: string; date: string; matches?: object[] };

/**
 * Same data as the league-leaders page non-cache path: all-time event aggregate + reign merge +
 * end-of-month belt map from Jan 2025 month-end onward.
 */
export async function loadLeagueLeadersAllTimeScoringBundle(
  db: Pick<SupabaseClient, "from">
): Promise<LeagueLeadersAllTimeScoringBundle> {
  const [{ data: rawReigns }, { data: allEventsData }] = await Promise.all([
    db.from("championship_history").select("*"),
    db
      .from("events")
      .select("id, name, date, matches")
      .in("status", [...EVENT_STATUSES_FOR_SCORING])
      .gte("date", LEAGUE_LEADERS_ALL_TIME_EVENTS_FROM)
      .order("date", { ascending: true })
      .limit(LEAGUE_LEADERS_ALL_TIME_EVENTS_LIMIT),
  ]);
  const eventsAll = (allEventsData ?? []) as EventRow[];
  const tableReigns = (rawReigns ?? []) as Parameters<typeof mergeReigns>[0];
  const inferredReigns = inferReignsFromEvents(eventsAll);
  const reigns = mergeReigns(tableReigns, inferredReigns);
  const pointsAllTimeBySlug = aggregateWrestlerPoints(eventsAll);
  const endOfMonthBeltPointsAllTime = computeEndOfMonthBeltPoints(reigns, LEAGUE_LEADERS_ALL_TIME_FIRST_MONTH_END);
  return { pointsAllTimeBySlug, endOfMonthBeltPointsAllTime };
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
  const p = getPointsForWrestler(pointsBySlug, slugKey, nameKey);
  const rs = finiteNum(p.rsPoints);
  const ple = finiteNum(p.plePoints);
  const beltBase = finiteNum(p.beltPoints);
  const extraBelt = finiteNum(getMonthlyBeltForWrestler(endOfMonthBeltPointsAllTime, slugKey, nameKey));
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
