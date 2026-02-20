/**
 * Private Leagues (MVL): standard season options.
 * Commissioners can choose one of these when creating a league (or set custom dates).
 */

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

export const SEASON_OPTIONS: SeasonOption[] = [
  {
    id: "road-to-summerslam",
    name: "Road to SummerSlam",
    slug: "road-to-summerslam",
    windowDescription: "First Raw in May through SummerSlam Night 2",
    startMonth: 5,
    endMonth: 8,
    crossesCalendarYear: false,
  },
  {
    id: "road-to-survivor-series",
    name: "Road to Survivor Series",
    slug: "road-to-survivor-series",
    windowDescription: "First Raw in August through Survivor Series (late November)",
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
];

export function getSeasonBySlug(slug: string): SeasonOption | undefined {
  return SEASON_OPTIONS.find((s) => s.slug === slug);
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
  const start_date = `${startYear}-${String(season.startMonth).padStart(2, "0")}-01`;
  const lastDay = lastDayOfMonth(endYear, season.endMonth);
  const end_date = `${endYear}-${String(season.endMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  return { start_date, end_date };
}
