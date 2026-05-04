/**
 * Private Leagues (MVL): roster change rules — line-up lock, roster lock, FA signing cap per week.
 * See docs/PUBLIC_LEAGUES_SCORING.md (Roster change rules).
 */

/** Line-up (who is active) locks this many minutes before the event start. */
export const LINEUP_LOCK_MINUTES_BEFORE_EVENT = 30;

/** Full roster (FA moves + line-up) locks this many minutes before the event start. */
export const ROSTER_LOCK_MINUTES_BEFORE_EVENT = 60;

/** Maximum free agent signings per faction per week (Mon–Sun UTC week); standalone drops are not counted. Trades unlimited. */
export const FA_SIGNINGS_PER_WEEK = 2;

/** @deprecated Use FA_SIGNINGS_PER_WEEK — enforcement counts signings only. */
export const FA_MOVES_PER_WEEK = FA_SIGNINGS_PER_WEEK;
