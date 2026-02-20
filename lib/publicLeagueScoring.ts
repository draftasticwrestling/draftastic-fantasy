/**
 * Private Leagues (MVL): Head to Head and Draftastic Championship Belt point constants.
 * See docs/PUBLIC_LEAGUES_SCORING.md for full rules.
 */

/** Points for winning a weekly Head to Head matchup (2 teams). */
export const H2H_WIN_POINTS = 10;

/** Points for tying a weekly Head to Head matchup (2 teams). */
export const H2H_TIE_POINTS = 5;

/** Points for winning a weekly Triple Threat matchup (3 teams). */
export const TRIPLE_THREAT_WIN_POINTS = 15;

/** Points for tying in a weekly Triple Threat matchup (3 teams). */
export const TRIPLE_THREAT_TIE_POINTS = 7.5;

/** Points awarded to the manager who first wins the Draftastic Championship Belt (e.g. June 1 leader). */
export const BELT_INITIAL_WIN_BONUS = 5;

/** Points for a successful belt defense in that week's H2H matchup. */
export const BELT_DEFENSE_POINTS = 4;

/** Points awarded at end of each month to the current belt holder. */
export const BELT_MONTHLY_HOLDER_BONUS = 10;

/** Date (month-day) when the belt is first awarded to the league leader. Default: June 1. */
export const BELT_INITIAL_AWARD_MONTH = 6;
export const BELT_INITIAL_AWARD_DAY = 1;
