import { getCivilYmdInPst } from "@/lib/pstCivilTime";
import { leagueUsesSalaryCap, PUBLIC_SALARY_CAP_SEASON_SLUG } from "@/lib/leagueStructure";

export { PUBLIC_SALARY_CAP_SEASON_SLUG } from "@/lib/leagueStructure";

/** Public leagues run for twelve weeks from the Monday start date. */
export const PUBLIC_SALARY_CAP_SEASON_WEEKS = 12;

export function isPublicSalaryCapLeague(
  league:
    | {
        visibility_type?: string | null;
        league_type?: string | null;
        season_slug?: string | null;
      }
    | null
    | undefined
): boolean {
  if (!league) return false;
  if (String(league.visibility_type ?? "").toLowerCase() !== "public") return false;
  return (
    leagueUsesSalaryCap(league.league_type) ||
    league.season_slug === PUBLIC_SALARY_CAP_SEASON_SLUG
  );
}

function parseYmd(ymd: string): { y: number; m: number; d: number } {
  const [ys, ms, ds] = ymd.split("-");
  return { y: Number(ys), m: Number(ms), d: Number(ds) };
}

function formatYmd(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Add calendar days to a YYYY-MM-DD string (UTC noon anchor). */
export function addDaysToYmd(ymd: string, days: number): string {
  const { y, m, d } = parseYmd(ymd);
  const dt = new Date(Date.UTC(y, m - 1, d + days, 12));
  return formatYmd(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

/**
 * Next Monday on or after `from` (Pacific calendar).
 * If `from` is already Monday in PT, returns that date.
 */
export function nextMondayPacificYmd(from: Date = new Date()): string {
  const todayYmd = getCivilYmdInPst(from.getTime());
  const { y, m, d } = parseYmd(todayYmd);
  const weekday = new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay();
  const daysUntilMonday = weekday === 1 ? 0 : weekday === 0 ? 1 : 8 - weekday;
  return addDaysToYmd(todayYmd, daysUntilMonday);
}

/** Twelve-week window: Monday start through Sunday of week 12. */
export function computePublicLeagueSeasonWindow(from: Date = new Date()): {
  start_date: string;
  end_date: string;
} {
  const start_date = nextMondayPacificYmd(from);
  const end_date = addDaysToYmd(start_date, PUBLIC_SALARY_CAP_SEASON_WEEKS * 7 - 1);
  return { start_date, end_date };
}
