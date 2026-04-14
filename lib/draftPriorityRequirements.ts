/** Autopick leagues: each manager must save at least this many ranked wrestler IDs before autopick runs. */
export const AUTOPICK_REQUIRED_PRIORITY_COUNT = 50;
/** Autopick leagues: at least this many listed wrestlers must normalize to female (see `normalizeDraftPoolGender`). */
export const AUTOPICK_REQUIRED_FEMALE_COUNT = 16;

/** After a manager's ranked list is exhausted, autopick uses this rule for everyone. */
export const AUTOPICK_LIST_EXHAUSTED_TIE_BREAK = "Best available by total points (all-time).";
