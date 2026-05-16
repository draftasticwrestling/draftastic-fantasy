/** Site-admin engagement time windows (UTC boundaries unless noted). */

export const ENGAGEMENT_PERIOD_KEYS = [
  "full_season",
  "season_to_date",
  "this_month",
  "this_week",
  "today",
  "yesterday",
  "last_28_days",
  "last_30_days",
] as const;

export type EngagementPeriodKey = (typeof ENGAGEMENT_PERIOD_KEYS)[number];

export type EngagementPeriodBounds = {
  /** Omit for full-season totals (season_slug filter only). */
  startInclusiveIso?: string;
  endExclusiveIso?: string;
};

export type SeasonCalendarRange = {
  /** Earliest league `start_date` in the season (YYYY-MM-DD). */
  startYmd: string | null;
  /** Latest league `end_date` in the season (YYYY-MM-DD), if any. */
  endYmd: string | null;
};

export const ENGAGEMENT_PERIOD_LABELS: Record<EngagementPeriodKey, string> = {
  full_season: "Full season",
  season_to_date: "Season to date",
  this_month: "This month",
  this_week: "This week",
  today: "Today",
  yesterday: "Yesterday",
  last_28_days: "Last 28 days",
  last_30_days: "Last 30 days",
};

function utcYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function utcDayStartIso(ymd: string): string {
  return `${ymd}T00:00:00.000Z`;
}

/** Next UTC calendar day after `ymd` (YYYY-MM-DD). */
export function utcNextCalendarDayYmd(ymd: string): string {
  const d = new Date(ymd + "T12:00:00.000Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return utcYmd(d);
}

function utcMondayOfWeekContaining(d: Date): string {
  const copy = new Date(d.getTime());
  const day = copy.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setUTCDate(copy.getUTCDate() + diff);
  return utcYmd(copy);
}

function addUtcDays(ymd: string, delta: number): string {
  const d = new Date(ymd + "T12:00:00.000Z");
  d.setUTCDate(d.getUTCDate() + delta);
  return utcYmd(d);
}

export function parseEngagementPeriodKey(raw: string | null | undefined): EngagementPeriodKey {
  if (raw && (ENGAGEMENT_PERIOD_KEYS as readonly string[]).includes(raw)) {
    return raw as EngagementPeriodKey;
  }
  return "season_to_date";
}

/**
 * UTC window for KPI queries. `full_season` has no date bounds (rely on `season_slug` on rows).
 * `season_to_date` uses league season dates when known, otherwise all season-tagged events.
 */
export function engagementPeriodBounds(
  period: EngagementPeriodKey,
  seasonRange: SeasonCalendarRange | null,
  now: Date = new Date()
): EngagementPeriodBounds {
  const todayYmd = utcYmd(now);
  const tomorrowYmd = utcNextCalendarDayYmd(todayYmd);
  const nowIso = now.toISOString();

  switch (period) {
    case "full_season":
      return {};
    case "season_to_date": {
      if (seasonRange?.startYmd) {
        return {
          startInclusiveIso: utcDayStartIso(seasonRange.startYmd),
          endExclusiveIso: nowIso,
        };
      }
      return { endExclusiveIso: nowIso };
    }
    case "this_month": {
      const monthStart = `${todayYmd.slice(0, 7)}-01`;
      return {
        startInclusiveIso: utcDayStartIso(monthStart),
        endExclusiveIso: nowIso,
      };
    }
    case "this_week": {
      const weekStart = utcMondayOfWeekContaining(now);
      return {
        startInclusiveIso: utcDayStartIso(weekStart),
        endExclusiveIso: nowIso,
      };
    }
    case "today":
      return {
        startInclusiveIso: utcDayStartIso(todayYmd),
        endExclusiveIso: nowIso,
      };
    case "yesterday": {
      const y = addUtcDays(todayYmd, -1);
      return {
        startInclusiveIso: utcDayStartIso(y),
        endExclusiveIso: utcDayStartIso(todayYmd),
      };
    }
    case "last_28_days":
      return {
        startInclusiveIso: utcDayStartIso(addUtcDays(todayYmd, -27)),
        endExclusiveIso: nowIso,
      };
    case "last_30_days":
      return {
        startInclusiveIso: utcDayStartIso(addUtcDays(todayYmd, -29)),
        endExclusiveIso: nowIso,
      };
    default:
      return {};
  }
}

export function eventOccurredInPeriod(
  occurredAtIso: string,
  bounds: EngagementPeriodBounds
): boolean {
  if (!bounds.startInclusiveIso && !bounds.endExclusiveIso) return true;
  const t = Date.parse(occurredAtIso);
  if (Number.isNaN(t)) return false;
  if (bounds.startInclusiveIso && t < Date.parse(bounds.startInclusiveIso)) return false;
  if (bounds.endExclusiveIso && t >= Date.parse(bounds.endExclusiveIso)) return false;
  return true;
}
