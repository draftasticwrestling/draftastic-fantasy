import { isPastEndOfDayPst } from "@/lib/pstCivilTime";

/** Must match `RTS_2026_LEAGUE_END_DATE` in beltRts2026JulyDeferral (kept here to avoid import cycles). */
const RTS_2026_LEAGUE_END_DATE = "2026-08-02";

function isRoadToSummerSlam2026WithSummerslamFinale(leagueEndYmd: string | null | undefined): boolean {
  return (leagueEndYmd ?? "").slice(0, 10) === RTS_2026_LEAGUE_END_DATE;
}

/** First week-ending Sunday (Mon–Sun league week) when weekly title-hold points apply. */
export const FIRST_WEEKLY_BELT_WEEK_END_SUNDAY = "2026-04-26";

/** Same calendar era as legacy `FIRST_END_OF_MONTH_POINTS_DATE`; kept for imports that still reference it. */
export const FIRST_END_OF_MONTH_POINTS_DATE = "2025-01-31";

function getMondayOfWeek(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00Z");
  const day = d.getUTCDay();
  const offset = (day + 6) % 7;
  d.setUTCDate(d.getUTCDate() - offset);
  return d.toISOString().slice(0, 10);
}

function getSundayOfWeek(weekStartMonday: string): string {
  const d = new Date(weekStartMonday + "T12:00:00.000Z");
  d.setUTCDate(d.getUTCDate() + 6);
  return d.toISOString().slice(0, 10);
}

export function addDaysYmdUtc(ymd: string, days: number): string {
  const d = new Date(ymd + "T12:00:00.000Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * First week-ending Sunday on or after the league start week that is also on or after the global
 * belt-scoring start (Jan 5, 2025).
 */
export function firstEligibleWeekEndSundayForLeagueStart(leagueStartYmd: string): string {
  let mon = getMondayOfWeek(leagueStartYmd);
  let sun = getSundayOfWeek(mon);
  while (sun < FIRST_WEEKLY_BELT_WEEK_END_SUNDAY) {
    mon = addDaysYmdUtc(mon, 7);
    sun = getSundayOfWeek(mon);
  }
  return sun;
}

/**
 * Last Sunday (end of a Mon–Sun scoring week) that may receive belt hold credit for this league,
 * inclusive. RTS 2026 SummerSlam finale uses the real season end date (Sunday Aug 2, 2026).
 */
/** Last week-ending Sunday on or before `ymd` (for inclusive caps that use arbitrary calendar dates). */
export function lastWeekEndSundayOnOrBefore(ymd: string): string {
  let sun = getSundayOfWeek(getMondayOfWeek(ymd));
  if (sun > ymd) sun = addDaysYmdUtc(sun, -7);
  return sun;
}

export function beltScoringLastWeekEndSundayInclusive(leagueEndYmd: string | null | undefined): string | undefined {
  if (!leagueEndYmd) return undefined;
  const d = leagueEndYmd.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return undefined;
  if (isRoadToSummerSlam2026WithSummerslamFinale(d)) return RTS_2026_LEAGUE_END_DATE;
  let sun = getSundayOfWeek(getMondayOfWeek(d));
  if (sun > d) sun = addDaysYmdUtc(sun, -7);
  return sun;
}

/**
 * Completed week-ending Sundays from `firstWeekEndSunday` through cap (inclusive), in order.
 * Stops at the first week whose Sunday has not yet ended in PST (belt not yet locked).
 */
export function getCompletedWeekEndSundaysForBeltScoring(
  firstWeekEndSunday: string,
  lastWeekEndSundayCap: string | undefined,
  nowMs: number = Date.now()
): string[] {
  const out: string[] = [];
  const cap = lastWeekEndSundayCap ? lastWeekEndSundayOnOrBefore(lastWeekEndSundayCap) : "9999-12-31";
  let cur = firstWeekEndSunday;
  while (cur && cur <= cap) {
    if (!isPastEndOfDayPst(cur, nowMs)) break;
    out.push(cur);
    cur = addDaysYmdUtc(cur, 7);
  }
  return out;
}
