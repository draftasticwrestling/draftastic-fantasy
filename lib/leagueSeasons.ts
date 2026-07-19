/**
 * Private Leagues (MVL): standard season options.
 * GMs can choose one of these when creating a league (or set custom dates).
 */

import { LEGACY_ROAD_TO_SURVIVOR_SERIES_SEASON_SLUG, ROAD_TO_WAR_GAMES_SEASON_SLUG } from "@/lib/leagueStructure";
import { computePublicLeagueRegistrationSchedule } from "@/lib/publicLeagueRegistration";

export type SeasonOption = {
  id: string;
  name: string;
  slug: string;
  /** Short description of the window, e.g. "First Raw in May – SummerSlam Night 2" */
  windowDescription: string;
  /** Default start month (1–12) for preset; "first Raw" may fall in this month. */
  startMonth: number;
  /** Default end month (1–12) for preset; PLE typically in this month. */
  endMonth: number;
  /** If end month is before start month (e.g. Dec–Apr), season crosses into next year. */
  crossesCalendarYear: boolean;
};

/** Standard (non-admin) private-league creation season. */
export const STANDARD_USER_CREATE_SEASON_SLUG = ROAD_TO_WAR_GAMES_SEASON_SLUG;

/**
 * Road to War Games 2026 window and league-creation cutoff.
 * - Season runs Aug 3 – Nov 28, 2026 (final PLE, Survivor Series: War Games).
 * - New private leagues may be formed until Monday, Oct 19, 2026 (six weeks out).
 */
export const ROAD_TO_WAR_GAMES_2026 = {
  season_start_ymd: "2026-08-03",
  season_end_ymd: "2026-11-28",
  /** Last Monday a new Road to War Games league may be created/started. */
  last_create_start_ymd: "2026-10-19",
} as const;

/** True when new Road to War Games private leagues can still be created on `todayYmd`. */
export function roadToWarGamesCreateOpen(
  todayYmd: string = new Date().toISOString().slice(0, 10)
): boolean {
  return todayYmd <= ROAD_TO_WAR_GAMES_2026.last_create_start_ymd;
}

export { PUBLIC_SALARY_CAP_SEASON_SLUG, PUBLIC_SALARY_CAP_SEASON_WEEKS } from "@/lib/publicLeagueSchedule";

export const SEASON_OPTIONS: SeasonOption[] = [
  {
    id: "road-to-summerslam",
    name: "Road to SummerSlam",
    slug: "road-to-summerslam",
    windowDescription: "WWE Backlash (May 9) through SummerSlam Night 2 (Aug 2), 2026 schedule",
    startMonth: 5,
    endMonth: 8,
    crossesCalendarYear: false,
  },
  {
    id: "road-to-war-games",
    name: "Road to War Games",
    slug: "road-to-war-games",
    windowDescription: "First Raw in August through Survivor Series: War Games (late November)",
    startMonth: 8,
    endMonth: 11,
    crossesCalendarYear: false,
  },
  {
    id: "road-to-wrestlemania",
    name: "Road to WrestleMania",
    slug: "road-to-wrestlemania",
    windowDescription: "First Raw in December through WrestleMania Night 2",
    startMonth: 12,
    endMonth: 4,
    crossesCalendarYear: true,
  },
  {
    id: "chamber-to-mania",
    name: "Chamber to Mania",
    slug: "chamber-to-mania",
    windowDescription: "Elimination Chamber through WrestleMania Night 2 (beta test season)",
    startMonth: 2,
    endMonth: 4,
    crossesCalendarYear: false,
  },
  {
    id: "public-salary-cap",
    name: "Public League — 12 weeks",
    slug: "public-salary-cap",
    windowDescription:
      "12-week salary cap season: enrollment until Monday RAW (5 PM PT), then scoring for 12 Monday–Sunday weeks",
    startMonth: 1,
    endMonth: 12,
    crossesCalendarYear: false,
  },
];

/**
 * Seasons offered in the admin "full options" create dropdown.
 * Road to SummerSlam is excluded (no new RTS leagues until it returns post-WrestleMania 2027),
 * and the rolling public salary-cap season is created through Play Now, not this form.
 */
export const CREATE_SEASON_OPTIONS: SeasonOption[] = SEASON_OPTIONS.filter(
  (s) => s.slug !== "road-to-summerslam" && s.slug !== "public-salary-cap"
);

export function getSeasonBySlug(slug: string): SeasonOption | undefined {
  const normalized =
    slug === LEGACY_ROAD_TO_SURVIVOR_SERIES_SEASON_SLUG ? ROAD_TO_WAR_GAMES_SEASON_SLUG : slug;
  return SEASON_OPTIONS.find((s) => s.slug === normalized);
}

export function getSeasonById(id: string): SeasonOption | undefined {
  return SEASON_OPTIONS.find((s) => s.id === id);
}

/** Last day of month for default end dates. */
function lastDayOfMonth(year: number, month: number): number {
  if (month === 2) return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28;
  if ([4, 6, 9, 11].includes(month)) return 30;
  return 31;
}

/**
 * Get default start_date and end_date (YYYY-MM-DD) for a season and year.
 * Used when creating a league from a standard season.
 */
export function getDefaultStartEndForSeason(
  seasonSlug: string,
  year: number
): { start_date: string; end_date: string } | null {
  const season = getSeasonBySlug(seasonSlug);
  if (!season) return null;

  const startYear = year;
  const endYear = season.crossesCalendarYear ? year + 1 : year;

  if (seasonSlug === "road-to-summerslam" && year === 2026) {
    return { start_date: "2026-05-09", end_date: "2026-08-02" };
  }

  // Road to War Games 2026: first Raw week (Aug 3) through Survivor Series: War Games
  // (Nov 28). Exactly 17 Monday–Sunday weeks; the Final is anchored to the Nov 23 week.
  if (
    (seasonSlug === ROAD_TO_WAR_GAMES_SEASON_SLUG ||
      seasonSlug === LEGACY_ROAD_TO_SURVIVOR_SERIES_SEASON_SLUG) &&
    year === 2026
  ) {
    return { start_date: ROAD_TO_WAR_GAMES_2026.season_start_ymd, end_date: ROAD_TO_WAR_GAMES_2026.season_end_ymd };
  }

  if (seasonSlug === "public-salary-cap") {
    const schedule = computePublicLeagueRegistrationSchedule();
    return { start_date: schedule.season_start_ymd, end_date: schedule.season_end_ymd };
  }

  const start_date = `${startYear}-${String(season.startMonth).padStart(2, "0")}-01`;
  const lastDay = lastDayOfMonth(endYear, season.endMonth);
  const end_date = `${endYear}-${String(season.endMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  return { start_date, end_date };
}
