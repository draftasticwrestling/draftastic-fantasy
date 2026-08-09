/** Shared league archive / inactivity constants (no server-only). */

/** Days after season end_date before a completed league auto-archives. */
export const LEAGUE_AUTO_ARCHIVE_DAYS_AFTER_END = 14;

export const LEAGUE_AUTO_ARCHIVE_REASON = `Auto-archived ${LEAGUE_AUTO_ARCHIVE_DAYS_AFTER_END} days after season end`;

export const PRIVATE_LEAGUE_INACTIVE_REASON =
  "Auto-marked inactive: fewer than the format minimum of owners after 2 weeks";

export const PRIVATE_LEAGUE_ABANDON_ARCHIVE_REASON =
  "Auto-archived: private league never reached the format minimum of owners within 4 weeks of creation";
