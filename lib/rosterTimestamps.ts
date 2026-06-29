import { getCivilYmdInPst } from "@/lib/pstCivilTime";

/**
 * Roster row `acquired_at` / `released_at` are calendar dates (YYYY-MM-DD), usually the move day in PT.
 * `*_at_ts` must be the real instant for live moves so post-show adds do not earn that day's event.
 */

/** UTC calendar date string YYYY-MM-DD from a Date (same as toISOString().slice(0,10)). */
export function utcYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Default roster calendar date for a live move (Pacific civil day). */
export function rosterCivilDateYmd(clock: Date = new Date()): string {
  return getCivilYmdInPst(clock.getTime());
}

/** Noon UTC placeholder written when only `acquired_at` was known. */
export function isSyntheticAcquiredTimestamp(
  isoTs: string | null | undefined,
  acquiredYmd: string
): boolean {
  if (!isoTs) return true;
  const d = acquiredYmd.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const t = String(isoTs).trim();
  return t === `${d}T12:00:00.000Z` || t === `${d}T12:00:00+00:00` || t === `${d}T12:00:00Z`;
}

/** End-of-UTC-day placeholder written when only `released_at` was known. */
export function isSyntheticReleasedTimestamp(
  isoTs: string | null | undefined,
  releasedYmd: string
): boolean {
  if (!isoTs) return true;
  const d = releasedYmd.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const t = String(isoTs).trim();
  return t === `${d}T23:59:59.999Z` || t === `${d}T23:59:59.999+00:00`;
}

function isExplicitBackdateYmd(ymd: string, clock: Date): boolean {
  const civil = ymd.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(civil)) return false;
  return civil !== utcYmd(clock) && civil !== rosterCivilDateYmd(clock);
}

/**
 * Timestamptz for `acquired_at_ts`.
 * Live moves use the real clock. Commissioner backdates use noon UTC on that roster date.
 */
export function timestamptzForAcquiredAtDate(acquiredDateYmd: string, clock: Date = new Date()): string {
  const ymd = acquiredDateYmd.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return clock.toISOString();
  if (!isExplicitBackdateYmd(ymd, clock)) return clock.toISOString();
  return `${ymd}T12:00:00.000Z`;
}

/**
 * Timestamptz for `released_at_ts`.
 * Live drops use the real clock. Backdated releases use end of that UTC calendar day.
 */
export function timestamptzForReleasedAtDate(releasedDateYmd: string, clock: Date = new Date()): string {
  const ymd = releasedDateYmd.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return clock.toISOString();
  if (!isExplicitBackdateYmd(ymd, clock)) return clock.toISOString();
  return `${ymd}T23:59:59.999Z`;
}
