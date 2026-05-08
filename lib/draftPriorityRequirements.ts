/** Autopick leagues: each manager must save at least this many ranked wrestler IDs before autopick runs. */
export const AUTOPICK_REQUIRED_PRIORITY_COUNT = 50;
/** Include-NXT leagues: use longer ranked lists so autopick is more reliable across larger pools. */
export const AUTOPICK_REQUIRED_PRIORITY_COUNT_INCLUDE_NXT = 119;
/** Autopick leagues: at least this many listed wrestlers must normalize to female (see `normalizeDraftPoolGender`). */
export const AUTOPICK_REQUIRED_FEMALE_COUNT = 16;

export function getAutopickRequiredPriorityCount(includeNxt: boolean): number {
  return includeNxt ? AUTOPICK_REQUIRED_PRIORITY_COUNT_INCLUDE_NXT : AUTOPICK_REQUIRED_PRIORITY_COUNT;
}

/** After a manager's ranked list is exhausted, autopick uses this rule for everyone. */
export const AUTOPICK_LIST_EXHAUSTED_TIE_BREAK = "Best available by total points (all-time).";
