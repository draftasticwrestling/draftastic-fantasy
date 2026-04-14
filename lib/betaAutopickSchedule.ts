/** Road to SummerSlam beta copy and UTC window for server-side autopick runs (no scheduled draft time). */

export const BETA_AUTOPICK_PREF_DEADLINE_LABEL = "April 30, 2026";
export const BETA_AUTOPICK_DRAFT_WINDOW_LABEL = "May 1–4, 2026";
export const BETA_AUTOPICK_ROSTERS_LIVE_LABEL = "around May 4, 2026";
export const BETA_AUTOPICK_FIRST_EVENT_LABEL = "WWE Backlash (May 9, 2026)";

/** Inclusive May 1 through end of May 4, 2026 UTC (May 5 00:00 UTC exclusive). */
export function isInBetaAutopickRunWindow(atMs: number): boolean {
  const start = Date.UTC(2026, 4, 1, 0, 0, 0, 0);
  const end = Date.UTC(2026, 4, 5, 0, 0, 0, 0);
  return atMs >= start && atMs < end;
}
