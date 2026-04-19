import { computeEndOfMonthBeltPointsForSingleMonth } from "@/lib/scoring/endOfMonthBeltPoints.js";

/** Default league end for RTS 2026 beta — SummerSlam Night 2 (season belt snapshot date). */
export const RTS_2026_LEAGUE_END_DATE = "2026-08-02";

/** July calendar month-end (not used for RTS 2026 — replaced by season-end snapshot). */
export const RTS_2026_JULY_MONTH_END = "2026-07-31";

export function isRoadToSummerSlam2026WithSummerslamFinale(leagueEndYmd: string | null | undefined): boolean {
  return (leagueEndYmd ?? "").slice(0, 10) === RTS_2026_LEAGUE_END_DATE;
}

/**
 * Inclusive cap on calendar month-ends for legacy title-hold belt scoring (`computeEndOfMonthBeltPoints`).
 * RTS 2026 uses the real league end (2026-08-02) so 2026-08-31 is excluded; otherwise last day of month containing league end.
 */
export function beltScoringLastMonthEndInclusive(leagueEndYmd: string | null | undefined): string | undefined {
  if (!leagueEndYmd) return undefined;
  const d = leagueEndYmd.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return undefined;
  if (isRoadToSummerSlam2026WithSummerslamFinale(d)) return d;
  const dt = new Date(d + "T12:00:00.000Z");
  return new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
}

/**
 * Replace July month-end with the season-finale snapshot (Aug 2): who holds titles after SummerSlam Night 2,
 * not who held them on 7/31.
 */
export function transformRts2026BeltMonthEnds(
  monthEnds: string[],
  leagueEndYmd: string | null | undefined
): string[] {
  if (!isRoadToSummerSlam2026WithSummerslamFinale(leagueEndYmd)) return monthEnds;
  const filtered = monthEnds.filter((me) => me !== RTS_2026_JULY_MONTH_END);
  const set = new Set(filtered);
  set.add(RTS_2026_LEAGUE_END_DATE);
  return [...set].sort((a, b) => a.localeCompare(b));
}

/** Skip the July calendar month-end row; RTS uses Aug 2 season snapshot instead. */
export function shouldSkipJulyMonthEndBeltForRts2026(
  monthEndYmd: string,
  leagueEndYmd: string | null | undefined
): boolean {
  return isRoadToSummerSlam2026WithSummerslamFinale(leagueEndYmd) && monthEndYmd === RTS_2026_JULY_MONTH_END;
}

/**
 * `computeEndOfMonthBeltPoints` sums calendar month-ends including July. For RTS 2026:
 * remove July's contribution and add the season-end snapshot (holders after SummerSlam Night 2) once past Aug 2.
 */
export function adjustRts2026LeagueAggregateBeltPoints(
  aggregateBySlug: Record<string, number>,
  reigns: Parameters<typeof computeEndOfMonthBeltPointsForSingleMonth>[0],
  firstEligibleMonthEnd: string,
  leagueEndYmd: string | null | undefined,
  todayYmd: string
): Record<string, number> {
  if (!isRoadToSummerSlam2026WithSummerslamFinale(leagueEndYmd)) return aggregateBySlug;

  const out: Record<string, number> = { ...aggregateBySlug };
  if (todayYmd > RTS_2026_JULY_MONTH_END) {
    const julyPts = computeEndOfMonthBeltPointsForSingleMonth(
      reigns,
      RTS_2026_JULY_MONTH_END,
      firstEligibleMonthEnd
    );
    for (const [k, v] of Object.entries(julyPts)) {
      if (v <= 0) continue;
      out[k] = (out[k] ?? 0) - v;
    }
  }

  if (todayYmd > RTS_2026_LEAGUE_END_DATE) {
    const seasonPts = computeEndOfMonthBeltPointsForSingleMonth(
      reigns,
      RTS_2026_LEAGUE_END_DATE,
      firstEligibleMonthEnd
    );
    for (const [k, v] of Object.entries(seasonPts)) {
      if (v <= 0) continue;
      out[k] = (out[k] ?? 0) + v;
    }
  }

  return out;
}
