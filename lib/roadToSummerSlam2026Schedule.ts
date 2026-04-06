/**
 * Road to SummerSlam 2026 beta: TV and PLE calendar (May 9 – Aug 2, 2026).
 * Used for help copy; scoring uses eventClassifier + pointsCalculator.
 */

export type ScheduleRow = {
  date: string;
  label: string;
  tier: "raw" | "smackdown" | "minor-ple" | "medium-ple" | "major-ple";
};

/** Ordered list of dates and show types for the 2026 beta window. */
export const ROAD_TO_SUMMERSLAM_2026_SCHEDULE: ScheduleRow[] = [
  { date: "2026-05-09", label: "WWE Backlash", tier: "minor-ple" },
  { date: "2026-05-11", label: "Raw", tier: "raw" },
  { date: "2026-05-15", label: "SmackDown", tier: "smackdown" },
  { date: "2026-05-18", label: "Raw", tier: "raw" },
  { date: "2026-05-22", label: "SmackDown", tier: "smackdown" },
  { date: "2026-05-23", label: "Saturday Night's Main Event XLIV", tier: "minor-ple" },
  { date: "2026-05-25", label: "Raw", tier: "raw" },
  { date: "2026-05-29", label: "SmackDown", tier: "smackdown" },
  { date: "2026-05-31", label: "Clash in Italy", tier: "minor-ple" },
  { date: "2026-06-01", label: "Raw", tier: "raw" },
  { date: "2026-06-05", label: "SmackDown", tier: "smackdown" },
  { date: "2026-06-08", label: "Raw", tier: "raw" },
  { date: "2026-06-12", label: "SmackDown", tier: "smackdown" },
  { date: "2026-06-15", label: "Raw", tier: "raw" },
  { date: "2026-06-19", label: "SmackDown", tier: "smackdown" },
  { date: "2026-06-22", label: "Raw", tier: "raw" },
  { date: "2026-06-26", label: "SmackDown", tier: "smackdown" },
  { date: "2026-06-27", label: "Night of Champions", tier: "medium-ple" },
  { date: "2026-06-29", label: "Raw", tier: "raw" },
  { date: "2026-07-03", label: "SmackDown", tier: "smackdown" },
  { date: "2026-07-06", label: "Raw", tier: "raw" },
  { date: "2026-07-10", label: "SmackDown", tier: "smackdown" },
  { date: "2026-07-13", label: "Raw", tier: "raw" },
  { date: "2026-07-17", label: "SmackDown", tier: "smackdown" },
  { date: "2026-07-18", label: "Saturday Night's Main Event XLV", tier: "minor-ple" },
  { date: "2026-07-20", label: "Raw", tier: "raw" },
  { date: "2026-07-24", label: "SmackDown", tier: "smackdown" },
  { date: "2026-07-27", label: "Raw", tier: "raw" },
  { date: "2026-07-31", label: "SmackDown", tier: "smackdown" },
  { date: "2026-08-01", label: "WWE SummerSlam (Night 1)", tier: "major-ple" },
  { date: "2026-08-02", label: "WWE SummerSlam (Night 2)", tier: "major-ple" },
];

export const ROAD_TO_SUMMERSLAM_2026_COPY = {
  starts: "2026-05-09",
  ends: "2026-08-02",
  countsLabel: "12 Raws, 12 SmackDowns, 4 minor PLEs, 1 medium PLE (Night of Champions), 2 major PLE nights (SummerSlam)",
} as const;

export {
  RTS_2026_LEAGUE_END_DATE,
  RTS_2026_JULY_MONTH_END,
  adjustRts2026LeagueAggregateBeltPoints,
  beltScoringLastMonthEndInclusive,
  isRoadToSummerSlam2026WithSummerslamFinale,
  shouldSkipJulyMonthEndBeltForRts2026,
  transformRts2026BeltMonthEnds,
} from "./beltRts2026JulyDeferral";
