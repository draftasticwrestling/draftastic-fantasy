/**
 * Roster row `acquired_at` / `released_at` are calendar dates (YYYY-MM-DD).
 * `*_at_ts` columns must represent an instant on that same calendar day (UTC) for
 * time-based scoring; using `new Date()` while backdating the date column causes
 * mismatches (e.g. acquired_at = 2026-03-15 but acquired_at_ts = 2026-03-17).
 */

/** UTC calendar date string YYYY-MM-DD from a Date (same as toISOString().slice(0,10)). */
export function utcYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Timestamptz for `acquired_at_ts`: aligns UTC date with `acquired_at`.
 * - If the roster date is **today** (UTC), use the actual clock time (pick order, audits).
 * - If the roster date is **any other day** (backdated commissioner add), use noon UTC that day.
 */
export function timestamptzForAcquiredAtDate(acquiredDateYmd: string, clock: Date = new Date()): string {
  const ymd = acquiredDateYmd.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return clock.toISOString();
  if (ymd === utcYmd(clock)) return clock.toISOString();
  return `${ymd}T12:00:00.000Z`;
}

/**
 * Timestamptz for `released_at_ts`: aligns UTC date with `released_at`.
 * - Same calendar day as clock → use actual instant.
 * - Backdated release → end of that UTC calendar day (still “had them that show date”).
 */
export function timestamptzForReleasedAtDate(releasedDateYmd: string, clock: Date = new Date()): string {
  const ymd = releasedDateYmd.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return clock.toISOString();
  if (ymd === utcYmd(clock)) return clock.toISOString();
  return `${ymd}T23:59:59.999Z`;
}
