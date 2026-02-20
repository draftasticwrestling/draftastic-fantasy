/**
 * Public Leagues (MVL): weekly matchup structure — Head to Head vs Triple Threat.
 * Use H2H when team count is even; when odd, use one Triple Threat so no one has a bye.
 * See docs/PUBLIC_LEAGUES_SCORING.md.
 */

import { MIN_LEAGUE_TEAMS, MAX_LEAGUE_TEAMS } from "./leagueStructure";

export type MatchupStructure = {
  /** Number of Head to Head matchups (each has 2 teams). */
  numH2H: number;
  /** Number of Triple Threat matchups (each has 3 teams). */
  numTripleThreat: number;
  /** Total number of matchups this week. */
  totalMatchups: number;
};

/**
 * Get the weekly matchup structure for a given number of teams.
 * - Even N: N/2 Head to Head matchups (no triple threats).
 * - Odd N: 1 Triple Threat (3 teams) + (N-3)/2 Head to Head matchups (no byes).
 * Returns null if teamCount is outside 3–12.
 */
export function getWeeklyMatchupStructure(teamCount: number): MatchupStructure | null {
  if (teamCount < MIN_LEAGUE_TEAMS || teamCount > MAX_LEAGUE_TEAMS) {
    return null;
  }
  if (teamCount % 2 === 0) {
    return {
      numH2H: teamCount / 2,
      numTripleThreat: 0,
      totalMatchups: teamCount / 2,
    };
  }
  const numTripleThreat = 1;
  const numH2H = (teamCount - 3) / 2;
  return {
    numH2H,
    numTripleThreat,
    totalMatchups: numH2H + numTripleThreat,
  };
}
