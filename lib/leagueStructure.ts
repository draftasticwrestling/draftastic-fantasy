/**
 * MVL (Road to SummerSlam) league structure: roster size and gender minimums
 * depend on number of teams in the league.
 */

export const MIN_LEAGUE_TEAMS = 3;
/** Upper bound for legacy leagues already in the database (larger than beta max). */
export const MAX_LEAGUE_TEAMS = 12;

/** Road to SummerSlam beta: new leagues may only use 3–6 teams. */
export const MAX_LEAGUE_TEAMS_BETA = 6;

export type RosterRules = {
  rosterSize: number;
  minFemale: number;
  minMale: number;
};

/**
 * Roster rules by number of teams (3–12). Index is team count.
 * 3–6: Road to SummerSlam 2026 beta (13 / 11 / 9 / 8 roster caps).
 * Road to SummerSlam: min 4 women on the roster for every roster size except size 8 (then min 3 women).
 * 7–12: legacy leagues created before beta caps.
 */
export const ROSTER_RULES_BY_TEAMS: Record<number, RosterRules> = {
  3: { rosterSize: 13, minFemale: 4, minMale: 5 },
  4: { rosterSize: 11, minFemale: 4, minMale: 4 },
  5: { rosterSize: 9, minFemale: 4, minMale: 4 },
  6: { rosterSize: 8, minFemale: 3, minMale: 4 },
  7: { rosterSize: 10, minFemale: 4, minMale: 4 },
  8: { rosterSize: 8, minFemale: 3, minMale: 4 },
  9: { rosterSize: 8, minFemale: 3, minMale: 4 },
  10: { rosterSize: 6, minFemale: 2, minMale: 2 },
  11: { rosterSize: 6, minFemale: 2, minMale: 2 },
  12: { rosterSize: 5, minFemale: 2, minMale: 2 },
};

/**
 * Active wrestlers per event (line-up size) by roster size.
 * Managers choose this many wrestlers to count for each event; the rest are benched.
 */
export const ACTIVE_PER_EVENT_BY_ROSTER_SIZE: Record<number, number> = {
  15: 8,
  13: 7,
  11: 6,
  10: 8,
  9: 5,
  8: 6,
  6: 4,
  5: 4,
  4: 4,
};

/**
 * Get roster rules for a league based on its current number of teams (members).
 * Returns null if team count is outside 3–12 (league not yet valid or over capacity).
 */
export function getRosterRulesForLeague(teamCount: number): RosterRules | null {
  if (teamCount < MIN_LEAGUE_TEAMS || teamCount > MAX_LEAGUE_TEAMS) {
    return null;
  }
  return ROSTER_RULES_BY_TEAMS[teamCount] ?? null;
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
