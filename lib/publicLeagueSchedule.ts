import { leagueUsesSalaryCap, PUBLIC_SALARY_CAP_SEASON_SLUG } from "@/lib/leagueStructure";
import { computeChampionshipPathwaySeasonWindow } from "@/lib/championshipPathwaySchedule";

export { PUBLIC_SALARY_CAP_SEASON_SLUG } from "@/lib/leagueStructure";
export {
  CHAMPIONSHIP_PATHWAY_BETA_KICKOFF_YMD,
  CHAMPIONSHIP_PATHWAY_SEASON_WEEKS,
  computeChampionshipPathwaySeasonWindow,
  getChampionshipPathwayWeeksInRange,
  isChampionshipPathwayKickoffFriday,
  nextFridayPacificYmd,
} from "@/lib/championshipPathwaySchedule";

/** Public leagues run for twelve Monday–Sunday weeks starting at Monday RAW (5 PM PT). */
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

/** Twelve-week Championship Pathway window (Friday kickoff through week 12 Sunday). */
export function computePublicLeagueSeasonWindow(from: Date = new Date()): {
  start_date: string;
  end_date: string;
} {
  return computeChampionshipPathwaySeasonWindow(from);
}
