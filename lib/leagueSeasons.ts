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
