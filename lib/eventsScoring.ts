/**
 * PWBS event row `status`: `live` while the show is in progress, `completed` when wrapped.
 * Fantasy scoring reads both so points update as each match is marked completed in Boxscore.
 *
 * Match-level: only rows with `match.status === "completed"` (or missing status for legacy
 * completed events) are scored — see `scoreEvent` in lib/scoring/scoreEvent.js.
 */
export const EVENT_STATUSES_FOR_SCORING = ["completed", "live"] as const;
