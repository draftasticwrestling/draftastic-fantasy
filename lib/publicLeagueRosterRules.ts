/**
 * Public Leagues (MVL): roster change rules — line-up lock, roster lock, FA moves per week.
 * See docs/PUBLIC_LEAGUES_SCORING.md (Roster change rules).
 */

/** Line-up (who is active) locks this many minutes before the event start. */
export const LINEUP_LOCK_MINUTES_BEFORE_EVENT = 30;

/** Full roster (FA moves + line-up) locks this many minutes before the event start. */
export const ROSTER_LOCK_MINUTES_BEFORE_EVENT = 60;

/** Maximum free agent signings/drops per manager per week. */
export const FA_MOVES_PER_WEEK = 2;
