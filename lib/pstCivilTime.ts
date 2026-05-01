/** Pacific time for belt-hold cutoffs (end-of-show / week close). */
export const BELT_HOLD_TIMEZONE = "America/Los_Angeles";

const pstYmdFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: BELT_HOLD_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Civil calendar date (YYYY-MM-DD) in America/Los_Angeles for this UTC instant. */
export function getCivilYmdInPst(utcMs: number): string {
  return pstYmdFormatter.format(new Date(utcMs));
}

/**
 * Last UTC millisecond that still falls on `ymd` in PST (inclusive end of that civil day in LA).
 */
export function endOfCivilDayPstMs(ymd: string): number {
  const y = Number(ymd.slice(0, 4));
  const mo = Number(ymd.slice(5, 7)) - 1;
  const day = Number(ymd.slice(8, 10));
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(day)) return Number.NaN;
  let lo = Date.UTC(y, mo, day) - 48 * 3600 * 1000;
  let hi = Date.UTC(y, mo, day) + 48 * 3600 * 1000;
  while (lo < hi - 1) {
    const mid = Math.floor((lo + hi) / 2);
    const d = getCivilYmdInPst(mid);
    if (d > ymd) hi = mid;
    else lo = mid;
  }
  return lo;
}

/** True once the week-ending Sunday has fully ended in PST (so late US shows can change the belt first). */
export function isPastEndOfDayPst(weekEndSundayYmd: string, nowMs: number = Date.now()): boolean {
  const endMs = endOfCivilDayPstMs(weekEndSundayYmd);
  if (!Number.isFinite(endMs)) return false;
  return nowMs > endMs;
}

/** Last calendar day (YYYY-MM-DD in Los Angeles) of the home-page public-league promo; switch copy the next PT day. */
export const HUB_HERO_PUBLIC_PROMO_LAST_YMD_LA = "2026-04-30";

/** True from the first instant of May 1, 2026 PT onward (i.e. after 11:59:59 PM PT on April 30, 2026). */
export function isPastHubHeroPublicPromoEnd(nowMs: number = Date.now()): boolean {
  return getCivilYmdInPst(nowMs) > HUB_HERO_PUBLIC_PROMO_LAST_YMD_LA;
}
