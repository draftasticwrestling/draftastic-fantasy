/**
 * MVL league structure: roster size and gender minimums depend on number of teams
 * and (for small leagues) whether the season is Road to SummerSlam beta.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export const MIN_LEAGUE_TEAMS = 3;
/** Upper bound for legacy leagues already in the database (larger than beta max). */
export const MAX_LEAGUE_TEAMS = 12;

/** Road to SummerSlam beta: new leagues may only use 3–6 teams. */
export const MAX_LEAGUE_TEAMS_BETA = 6;

/** Season slug from `lib/leagueSeasons` — only this season uses RTS beta roster caps for 3–6 teams. */
export const ROAD_TO_SUMMERSLAM_SEASON_SLUG = "road-to-summerslam";

/**
 * League UI header for Road to SummerSlam (desktop season rail, mobile pathway page).
 * Single source of truth so asset swaps apply everywhere.
 */
export const ROAD_TO_SUMMERSLAM_BANNER_SRC = "/images/season-belts/road-to-summer-belt-26.png";

/** Road to Survivor Series (admin beta / NXT + H2H testing). */
export const ROAD_TO_SURVIVOR_SERIES_SEASON_SLUG = "road-to-survivor-series";

/** Weekly PST title-hold belt (Mon–Sun week; credits once all PWBS events in that week are completed). */
export function leagueUsesWeeklyPstBeltHold(seasonSlug: string | null | undefined): boolean {
  return (
    seasonSlug === ROAD_TO_SUMMERSLAM_SEASON_SLUG || seasonSlug === ROAD_TO_SURVIVOR_SERIES_SEASON_SLUG
  );
}

/** Admin/beta leagues that include NXT in the player pool and scoring. */
export function leagueIncludesNxt(
  league: { include_nxt?: boolean | null } | null | undefined
): boolean {
  return Boolean(league?.include_nxt);
}

export type RosterRules = {
  rosterSize: number;
  minFemale: number;
  minMale: number;
};

/**
 * Legacy roster rules by team count (7–12). Used for all non–Road-to-SummerSlam leagues,
 * and for RTS leagues with 7+ teams. For non-RTS leagues with 3–6 teams, we use the 7-team row.
 */
export const LEGACY_ROSTER_RULES_BY_TEAMS: Record<number, RosterRules> = {
  7: { rosterSize: 10, minFemale: 4, minMale: 4 },
  8: { rosterSize: 8, minFemale: 3, minMale: 4 },
  9: { rosterSize: 8, minFemale: 3, minMale: 4 },
  10: { rosterSize: 6, minFemale: 2, minMale: 2 },
  11: { rosterSize: 6, minFemale: 2, minMale: 2 },
  12: { rosterSize: 5, minFemale: 2, minMale: 2 },
};

/**
 * Road to SummerSlam 2026 beta only: roster caps for 3–6 factions (tighter ladder than legacy 7-team baseline).
 */
export const RTS_BETA_ROSTER_RULES_3_TO_6: Record<number, RosterRules> = {
  3: { rosterSize: 13, minFemale: 4, minMale: 5 },
  4: { rosterSize: 11, minFemale: 4, minMale: 4 },
  5: { rosterSize: 9, minFemale: 4, minMale: 4 },
  6: { rosterSize: 8, minFemale: 3, minMale: 4 },
};

/**
 * Include-NXT leagues need deeper rosters because the draft/scoring pool expands.
 * Applies to both Head-to-Head and Total Season Points when `include_nxt` is true.
 */
export const INCLUDE_NXT_ROSTER_RULES_BY_TEAMS: Record<number, RosterRules> = {
  3: { rosterSize: 13, minFemale: 4, minMale: 5 },
  4: { rosterSize: 12, minFemale: 4, minMale: 4 },
  5: { rosterSize: 12, minFemale: 4, minMale: 4 },
  6: { rosterSize: 12, minFemale: 4, minMale: 4 },
  7: { rosterSize: 12, minFemale: 4, minMale: 4 },
  8: { rosterSize: 12, minFemale: 4, minMale: 4 },
  9: { rosterSize: 12, minFemale: 4, minMale: 4 },
  10: { rosterSize: 10, minFemale: 3, minMale: 3 },
  11: { rosterSize: 10, minFemale: 3, minMale: 3 },
  12: { rosterSize: 9, minFemale: 3, minMale: 3 },
};

/**
 * Head-to-Head and Combo (H2H + season points): deeper benches than legacy Total Season Points.
 * Roster size 12 for every supported team count; gender floors align with expanded NXT-inclusive ladder.
 */
export const HEAD_TO_HEAD_ROSTER_RULES_BY_TEAMS: Record<number, RosterRules> = {
  3: { rosterSize: 12, minFemale: 4, minMale: 5 },
  4: { rosterSize: 12, minFemale: 4, minMale: 4 },
  5: { rosterSize: 12, minFemale: 4, minMale: 4 },
  6: { rosterSize: 12, minFemale: 4, minMale: 4 },
  7: { rosterSize: 12, minFemale: 4, minMale: 4 },
  8: { rosterSize: 12, minFemale: 4, minMale: 4 },
  9: { rosterSize: 12, minFemale: 4, minMale: 4 },
  10: { rosterSize: 12, minFemale: 4, minMale: 4 },
  11: { rosterSize: 12, minFemale: 4, minMale: 4 },
  12: { rosterSize: 12, minFemale: 4, minMale: 4 },
};

/** Leagues that use {@link HEAD_TO_HEAD_ROSTER_RULES_BY_TEAMS} instead of the Total Season Points ladder. */
export function leagueUsesHeadToHeadStyleRosterRules(leagueType: string | null | undefined): boolean {
  return leagueType === "head_to_head" || leagueType === "combo";
}

/**
 * @deprecated Use LEGACY_ROSTER_RULES_BY_TEAMS + RTS_BETA_ROSTER_RULES_3_TO_6 via getRosterRulesForLeague.
 * Merged view for debugging/docs only — do not use for new code.
 */
export const ROSTER_RULES_BY_TEAMS: Record<number, RosterRules> = {
  ...RTS_BETA_ROSTER_RULES_3_TO_6,
  ...LEGACY_ROSTER_RULES_BY_TEAMS,
};

/**
 * Active wrestlers per event (line-up size) by roster size.
 * Managers choose this many wrestlers to count for each event; the rest are benched.
 */
export const ACTIVE_PER_EVENT_BY_ROSTER_SIZE: Record<number, number> = {
  15: 8,
  13: 7,
  12: 7,
  11: 6,
  10: 8,
  9: 5,
  8: 6,
  6: 4,
  5: 4,
  4: 4,
};

/**
 * Get roster rules for a league based on team count and season.
 *
 * - `league_type` **head_to_head** or **combo**: {@link HEAD_TO_HEAD_ROSTER_RULES_BY_TEAMS} (roster 12 for 3–12 teams).
 * - Road to SummerSlam (`season_slug === road-to-summerslam`) with 3–6 teams: RTS beta caps.
 * - All other seasons (including Total Season Points test leagues in other seasons): legacy rules.
 *   For 3–6 teams, legacy uses the same rules as a 7-team league (roster 10 / mins 4F+4M).
 * - 7–12 teams: same legacy ladder for every season.
 */
export function getRosterRulesForLeague(
  teamCount: number,
  seasonSlug?: string | null,
  includeNxt?: boolean | null,
  leagueType?: string | null
): RosterRules | null {
  if (teamCount < MIN_LEAGUE_TEAMS || teamCount > MAX_LEAGUE_TEAMS) {
    return null;
  }
  if (leagueUsesHeadToHeadStyleRosterRules(leagueType)) {
    return HEAD_TO_HEAD_ROSTER_RULES_BY_TEAMS[teamCount] ?? null;
  }
  if (includeNxt) {
    return INCLUDE_NXT_ROSTER_RULES_BY_TEAMS[teamCount] ?? null;
  }
  const isRoadToSummerSlam = seasonSlug === ROAD_TO_SUMMERSLAM_SEASON_SLUG;
  if (isRoadToSummerSlam && teamCount >= 3 && teamCount <= 6) {
    return RTS_BETA_ROSTER_RULES_3_TO_6[teamCount] ?? null;
  }
  const legacyKey = teamCount < 7 ? 7 : teamCount;
  return LEGACY_ROSTER_RULES_BY_TEAMS[legacyKey] ?? null;
}

/**
 * Load `season_slug` and compute roster rules in one round-trip (plus member count).
 * Use from server code that only has `leagueId`.
 */
export async function getRosterRulesForLeagueId(
  supabase: Pick<SupabaseClient, "from">,
  leagueId: string
): Promise<RosterRules | null> {
  const [{ count }, { data: league }] = await Promise.all([
    supabase.from("league_members").select("*", { count: "exact", head: true }).eq("league_id", leagueId),
    supabase.from("leagues").select("season_slug, include_nxt, league_type").eq("id", leagueId).maybeSingle(),
  ]);
  const teamCount = count ?? 0;
  const seasonSlug = (league as { season_slug?: string | null } | null)?.season_slug ?? null;
  const includeNxt = (league as { include_nxt?: boolean | null } | null)?.include_nxt ?? false;
  const leagueType = (league as { league_type?: string | null } | null)?.league_type ?? null;
  return getRosterRulesForLeague(teamCount, seasonSlug, includeNxt, leagueType);
}

/**
 * Check if a team count is within the allowed league size range.
 */
export function isLeagueSizeValid(teamCount: number): boolean {
  return teamCount >= MIN_LEAGUE_TEAMS && teamCount <= MAX_LEAGUE_TEAMS;
}

/**
 * Get how many wrestlers can be active (count for scoring) per event for a given roster size.
 * Returns undefined if roster size is not in the active-per-event table.
 */
export function getActivePerEvent(rosterSize: number): number | undefined {
  return ACTIVE_PER_EVENT_BY_ROSTER_SIZE[rosterSize];
}
