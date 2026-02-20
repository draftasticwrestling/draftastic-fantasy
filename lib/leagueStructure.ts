/**
 * MVL (Road to SummerSlam) league structure: roster size and gender minimums
 * depend on number of teams in the league.
 */

export const MIN_LEAGUE_TEAMS = 3;
export const MAX_LEAGUE_TEAMS = 12;

export type RosterRules = {
  rosterSize: number;
  minFemale: number;
  minMale: number;
};

/** Roster rules by number of teams (3–12). Index is team count. */
export const ROSTER_RULES_BY_TEAMS: Record<number, RosterRules> = {
  3: { rosterSize: 15, minFemale: 6, minMale: 6 },
  4: { rosterSize: 15, minFemale: 6, minMale: 6 },
  5: { rosterSize: 15, minFemale: 6, minMale: 6 },
  6: { rosterSize: 10, minFemale: 4, minMale: 4 },
  7: { rosterSize: 10, minFemale: 4, minMale: 4 },
  8: { rosterSize: 8, minFemale: 3, minMale: 3 },
  9: { rosterSize: 8, minFemale: 3, minMale: 3 },
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
  10: 8,
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
