/** First calendar day (PT) league home shows Top 10 weekly/season leaderboards. */
export const LEAGUE_HOME_TOP10_VISIBLE_FROM_PT = "2026-05-10";

/**
 * Leaderboards are hidden before this date in America/Los_Angeles (inclusive on launch day).
 */
export function isLeagueHomeTop10Visible(now = new Date()): boolean {
  const ptYmd = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return ptYmd >= LEAGUE_HOME_TOP10_VISIBLE_FROM_PT;
}
