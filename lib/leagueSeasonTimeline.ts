/**
 * League sidebar season timeline: one chronological numbered track — Raw, SmackDown,
 * all PLEs including season finales (WrestleMania nights, SummerSlam, Survivor Series).
 */

import {
  classifyEventType,
  EVENT_TYPES,
  isPLE,
} from "@/lib/scoring/parsers/eventClassifier.js";

export type SeasonPhaseId =
  | "road-to-summerslam"
  | "road-to-survivor-series"
  | "road-to-wrestlemania";

export type SeasonPhaseInfo = {
  id: SeasonPhaseId;
  title: string;
};

const WEEKLY_TIMELINE_TYPES = new Set<string>([EVENT_TYPES.RAW, EVENT_TYPES.SMACKDOWN]);

/** Season-capping shows — bold in the UI. */
const FINALE_EVENT_TYPES = new Set<string>([
  EVENT_TYPES.WRESTLEMANIA_NIGHT_1,
  EVENT_TYPES.WRESTLEMANIA_NIGHT_2,
  EVENT_TYPES.SUMMERSLAM_NIGHT_1,
  EVENT_TYPES.SUMMERSLAM_NIGHT_2,
  EVENT_TYPES.SURVIVOR_SERIES,
]);

export type RawEventRow = {
  id: string;
  name: string | null;
  date: string | null;
  status: string | null;
};

export type TimelineStep = {
  index: number;
  id: string;
  name: string;
  date: string;
  completed: boolean;
  isNext: boolean;
  /** Weekly TV vs premium live event (for styling). */
  kind: "weekly" | "ple";
  /** WrestleMania / SummerSlam / Survivor Series caps — emphasize in UI. */
  isFinale: boolean;
};

export type LeagueSeasonTimelinePayload = {
  seasonPhase: SeasonPhaseInfo;
  windowStart: string;
  windowEnd: string;
  steps: TimelineStep[];
  /** YYYY-MM-DD server-ish “today” for client display consistency */
  today: string;
};

/**
 * Three annual arcs (approximate WWE calendar):
 * - May–Jul: Road to SummerSlam
 * - Aug–Oct: Road to Survivor Series
 * - Nov–Apr: Road to WrestleMania (wraps year)
 */
export function seasonPhaseFromYmd(ymd: string): SeasonPhaseInfo {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    return { id: "road-to-wrestlemania", title: "The Road to WrestleMania" };
  }
  const month = Number(ymd.slice(5, 7));
  if (month >= 5 && month <= 7) {
    return { id: "road-to-summerslam", title: "The Road to SummerSlam" };
  }
  if (month >= 8 && month <= 10) {
    return { id: "road-to-survivor-series", title: "The Road to Survivor Series" };
  }
  return { id: "road-to-wrestlemania", title: "The Road to WrestleMania" };
}

function compareYmd(a: string, b: string): number {
  return a.localeCompare(b);
}

/**
 * Build timeline from Supabase `events` rows. Uses effective league start (draft-first)
 * and end_date upper bound (inclusive).
 */
export function buildLeagueSeasonTimeline(params: {
  events: RawEventRow[];
  effectiveStartYmd: string;
  endDateYmd: string | null;
  todayYmd: string;
}): LeagueSeasonTimelinePayload {
  const { events, effectiveStartYmd, endDateYmd, todayYmd } = params;
  const windowStart = effectiveStartYmd;
  const windowEnd = endDateYmd && /^\d{4}-\d{2}-\d{2}$/.test(endDateYmd) ? endDateYmd : "2099-12-31";

  const seasonPhase = seasonPhaseFromYmd(windowStart);

  const inWindow = (dateStr: string | null): dateStr is string => {
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr.slice(0, 10))) return false;
    const d = dateStr.slice(0, 10);
    return compareYmd(d, windowStart) >= 0 && compareYmd(d, windowEnd) <= 0;
  };

  const completed = (row: RawEventRow): boolean => {
    const s = (row.status ?? "").toLowerCase();
    if (s === "completed") return true;
    const d = row.date?.slice(0, 10);
    if (d && compareYmd(d, todayYmd) < 0) return true;
    return false;
  };

  const sorted = [...events].filter((e) => inWindow(e.date)).sort((a, b) => {
    const da = a.date?.slice(0, 10) ?? "";
    const db = b.date?.slice(0, 10) ?? "";
    return compareYmd(da, db);
  });

  const mainTrackRows: { row: RawEventRow; kind: "weekly" | "ple"; isFinale: boolean }[] = [];

  for (const row of sorted) {
    const t = classifyEventType(row.name ?? "", row.id);
    if (t === EVENT_TYPES.UNKNOWN) continue;
    if (WEEKLY_TIMELINE_TYPES.has(t)) {
      mainTrackRows.push({ row, kind: "weekly", isFinale: false });
    } else if (isPLE(t)) {
      mainTrackRows.push({ row, kind: "ple", isFinale: FINALE_EVENT_TYPES.has(t) });
    }
  }

  const steps: Omit<TimelineStep, "isNext">[] = mainTrackRows.map(({ row, kind, isFinale }, i) => ({
    index: i + 1,
    id: row.id,
    name: row.name ?? "Event",
    date: row.date!.slice(0, 10),
    completed: completed(row),
    kind,
    isFinale,
  }));

  const firstIncomplete = steps.findIndex((s) => !s.completed);

  const stepsOut: TimelineStep[] = steps.map((s, i) => ({
    ...s,
    isNext: i === firstIncomplete && firstIncomplete >= 0,
  }));

  return {
    seasonPhase,
    windowStart,
    windowEnd: endDateYmd && /^\d{4}-\d{2}-\d{2}$/.test(endDateYmd) ? endDateYmd : windowEnd,
    steps: stepsOut,
    today: todayYmd,
  };
}
