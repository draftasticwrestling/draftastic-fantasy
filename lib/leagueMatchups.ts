import {
  enrichRosterStintsWithActivityTimestamps,
  fetchLeagueActivityForStintEnrichment,
} from "@/lib/rosterStintActivityEnrichment";
import { getEventBroadcastStartMs } from "@/lib/eventBroadcastStart";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getRosterStintsForLeague, getLeagueScoring, getWrestlerDisplayNamesByIds } from "@/lib/leagues";
import { getPointsForSingleEvent } from "@/lib/scoring/aggregateWrestlerPoints.js";
import { brandByWrestlerSlugFromRows } from "@/lib/wrestlerBrandLookup";
import { eventPointsForRosterStint, sumMonthlyBeltPointsForStint } from "@/lib/scoring/rosterStintEventPoints";
import {
  compareStintsForEventTieBreak,
  rosterStintActiveForEvent,
  rosterStintActiveForMonthEndBelt,
  rosterStintActiveForWeeklyBeltHold,
} from "@/lib/scoring/rosterStintEventWindow";
import { getWeeklyMatchupStructure } from "@/lib/publicLeagueMatchups";
import {
  BELT_REIGN_INFERENCE_EVENTS_FROM,
  computeEndOfMonthBeltPointsForSingleMonth,
  computeWeeklyBeltHoldPointsForWeekEndSunday,
  firstLegacyCalendarMonthEndEligibleForLeagueStart,
  inferReignsFromEvents,
  mergeReigns,
} from "@/lib/scoring/endOfMonthBeltPoints.js";
import {
  beltScoringLastWeekEndSundayInclusive,
  firstEligibleWeekEndSundayForLeagueStart,
  fantasyWeekBeltScoringUnlocked,
  weeklyBeltSnapshotYmdForWeek,
} from "@/lib/beltWeeklyHold";
import { isPastEndOfDayPst } from "@/lib/pstCivilTime";
import {
  leagueIncludesNxt,
  leagueUsesSalaryCap,
  leagueUsesWeeklyPstBeltHold,
  ROAD_TO_SUMMERSLAM_SEASON_SLUG,
} from "@/lib/leagueStructure";
import { classifyEventType, EVENT_TYPES } from "@/lib/scoring/parsers/eventClassifier.js";
import { wrestlerRosterFromBrand } from "@/lib/wrestlerRosterFromBrand";
import { getCurrentChampionsMonthlyBeltBySlug } from "@/lib/scoring/currentChampionsBeltSnapshot";
import {
  isRoadToSummerSlam2026WithSummerslamFinale,
  legacySeasonEndBeltSnapshotYmd,
  RTS_2026_LEAGUE_END_DATE,
  shouldSkipJulyMonthEndBeltForRts2026,
} from "@/lib/beltRts2026JulyDeferral";

import {
  CHAMPIONSHIP_CHANGES_TABLE_NAME,
  inferReignsFromChampionshipChanges,
} from "@/lib/championshipCurrentFromChanges";
import { EVENT_STATUSES_FOR_SCORING, EVENT_STATUSES_FOR_WEEK_SCHEDULE, SCORING_EVENTS_FETCH_LIMIT } from "@/lib/eventsScoring";
import {
  getMondayOfWeek,
  getSundayOfWeek,
  getWeekEndForWeekStart,
  getWeeksInRange,
} from "@/lib/fantasyWeekBounds";

export { getMondayOfWeek, getSundayOfWeek, getWeekEndForWeekStart, getWeeksInRange };

/** Last day of month that falls within [weekStart, weekEnd], or null. */
export function getMonthEndInWeek(weekStart: string, weekEnd: string): string | null {
  const fromStart = getLastDayOfMonthContaining(weekStart);
  if (fromStart >= weekStart && fromStart <= weekEnd) return fromStart;
  const fromEnd = getLastDayOfMonthContaining(weekEnd);
  if (fromEnd >= weekStart && fromEnd <= weekEnd) return fromEnd;
  return null;
}

/** Last day (YYYY-MM-DD) of the month that contains the given date. */
function getLastDayOfMonthContaining(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00Z");
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth();
  const lastDay = new Date(Date.UTC(year, month + 1, 0));
  return lastDay.toISOString().slice(0, 10);
}

type RosterStintRow = {
  user_id: string;
  wrestler_id: string;
  contract: string | null;
  acquired_at: string;
  released_at: string | null;
  acquired_at_ts?: string | null;
  released_at_ts?: string | null;
};

/**
 * Single-calendar-week slice of the same event→owner rules as `getLeagueScoring` in `lib/leagues.ts`
 * (KOTR carryover across all in-range events; per-event “best stint” when overlaps exist in draft leagues;
 * salary cap awards every active stint; RTS NXT-brand omission unless the league has `include_nxt`).
 * Keeping these aligned is required so hub “season” (from `getLeagueScoring`) matches “this week” from matchups.
 */
function accumulateOwnerEventPointsForCalendarWeek(
  allInRangeSorted: Array<{
    id: string;
    name: string | null;
    date: string | null;
    matches: unknown;
    broadcast_start_ts?: string | null;
  }>,
  weekStartMonday: string,
  weekEndSunday: string,
  stints: RosterStintRow[],
  wrestlerDisplayNames: Record<string, string>,
  brandBySlug: ReturnType<typeof brandByWrestlerSlugFromRows>,
  seasonSlug: string | null,
  nxtRosterByWrestlerId: Record<string, boolean>,
  includeNxt: boolean,
  sharedWrestlerPool: boolean
): {
  pointsByOwner: Record<string, number>;
  pointsByOwnerByWrestler: Record<string, Record<string, number>>;
} {
  const ROSTER_STINT_DATE_OFFSET_DAYS = -1;
  const enforceMainRosterOnlyForNxt =
    (seasonSlug ?? null) === ROAD_TO_SUMMERSLAM_SEASON_SLUG && !includeNxt;
  /** Include-NXT leagues score main-roster wrestlers on NXT cards; omit brand filter (see skipMainRosterNxtSeasonPoints). */
  const brandBySlugForEventScoring = includeNxt ? null : brandBySlug;
  const pointsByOwner: Record<string, number> = {};
  const pointsByOwnerByWrestler: Record<string, Record<string, number>> = {};
  let kotrCarryOver: Record<string, number> = {};

  for (const event of allInRangeSorted) {
    const eventDate = (event.date ?? "").toString().slice(0, 10);
    const eventType = classifyEventType(event.name ?? "", event.id ?? "");
    const { pointsBySlug: eventPoints, callUpBySlug, updatedCarryOver } = getPointsForSingleEvent(
      event as never,
      kotrCarryOver,
      brandBySlugForEventScoring
    );
    kotrCarryOver = updatedCarryOver;

    const eventEndOfDayMs = Date.parse(`${eventDate}T23:59:59.999Z`);
    const eventStartMs = getEventBroadcastStartMs(event);
    const useBroadcastStart = eventStartMs != null && Number.isFinite(eventStartMs);
    const eventMs = eventEndOfDayMs;
    const broadcastStartMs = useBroadcastStart ? eventStartMs! : undefined;

    const inWeek = eventDate >= weekStartMonday && eventDate <= weekEndSunday;

    const bestStintByWrestlerId: Record<string, RosterStintRow> = {};
    if (!sharedWrestlerPool) {
      for (const stint of stints) {
        if (
          !rosterStintActiveForEvent({
            eventDate,
            eventMs,
            broadcastStartMs,
            useBroadcastStart,
            stint,
            rosterStintDateOffsetDays: ROSTER_STINT_DATE_OFFSET_DAYS,
          })
        ) {
          continue;
        }
        const wid = stint.wrestler_id;
        const currentBest = bestStintByWrestlerId[wid];
        if (!currentBest) {
          bestStintByWrestlerId[wid] = stint;
          continue;
        }
        if (compareStintsForEventTieBreak(stint, currentBest, useBroadcastStart, ROSTER_STINT_DATE_OFFSET_DAYS) < 0) {
          bestStintByWrestlerId[wid] = stint;
        }
      }
    }

    if (!inWeek) continue;

    for (const stint of stints) {
      if (
        !rosterStintActiveForEvent({
          eventDate,
          eventMs,
          broadcastStartMs,
          useBroadcastStart,
          stint,
          rosterStintDateOffsetDays: ROSTER_STINT_DATE_OFFSET_DAYS,
        })
      ) {
        continue;
      }
      if (!sharedWrestlerPool && bestStintByWrestlerId[stint.wrestler_id] !== stint) continue;
      if (
        enforceMainRosterOnlyForNxt &&
        eventPointsForRosterStint(callUpBySlug, stint.wrestler_id, wrestlerDisplayNames[stint.wrestler_id], eventDate) <= 0 &&
        nxtRosterByWrestlerId[stint.wrestler_id] &&
        (eventType === EVENT_TYPES.NXT || String(eventType).startsWith("nxt-"))
      ) {
        continue;
      }

      const pts = eventPointsForRosterStint(
        eventPoints,
        stint.wrestler_id,
        wrestlerDisplayNames[stint.wrestler_id],
        eventDate
      );

      pointsByOwner[stint.user_id] = (pointsByOwner[stint.user_id] ?? 0) + pts;
      if (pts > 0) {
        if (!pointsByOwnerByWrestler[stint.user_id]) pointsByOwnerByWrestler[stint.user_id] = {};
        pointsByOwnerByWrestler[stint.user_id][stint.wrestler_id] =
          (pointsByOwnerByWrestler[stint.user_id][stint.wrestler_id] ?? 0) + pts;
      }
    }
  }

  return { pointsByOwner, pointsByOwnerByWrestler };
}

/** Points per owner for a single week (Monday–Sunday). Uses acquisition/release windows.
 * Only events in the week and in league range count; KOTR carryover uses all league events in order. */
export async function getPointsByOwnerForLeagueForWeek(
  leagueId: string,
  weekStartMonday: string,
  supabaseOverride?: SupabaseClient
): Promise<Record<string, number>> {
  const supabase = supabaseOverride ?? (await createClient());
  const { data: league } = await supabase
    .from("leagues")
    .select("id, start_date, end_date, draft_date, season_slug, include_nxt, league_type")
    .eq("id", leagueId)
    .single();
  if (!league) return {};

  const leagueStart = (league.draft_date || league.start_date) ?? "";
  const weekEndSunday = getWeekEndForWeekStart(weekStartMonday, leagueStart);
  const leagueEnd = league.end_date ?? "";
  const seasonSlug = (league as { season_slug?: string | null }).season_slug ?? null;
  const includeNxt = leagueIncludesNxt(
    league as { include_nxt?: boolean | null; league_type?: string | null }
  );
  const sharedWrestlerPool = leagueUsesSalaryCap(
    (league as { league_type?: string | null }).league_type
  );

  const eventsSelectWithStart = supabase
    .from("events")
    .select("id, name, date, broadcast_start_ts, matches")
    .in("status", [...EVENT_STATUSES_FOR_SCORING])
    .order("date", { ascending: true })
    .limit(SCORING_EVENTS_FETCH_LIMIT);
  const { data: eventsWithStart, error: eventsErr } = await eventsSelectWithStart;
  const events =
    eventsWithStart ??
    (eventsErr && /column.*broadcast_start_ts does not exist/i.test(eventsErr.message ?? "")
      ? (
          await supabase
            .from("events")
            .select("id, name, date, matches")
            .in("status", [...EVENT_STATUSES_FOR_SCORING])
            .order("date", { ascending: true })
            .limit(SCORING_EVENTS_FETCH_LIMIT)
        ).data ?? []
      : []);

  const allInRange = (events ?? []).filter((e) => {
    const d = (e.date ?? "").toString().slice(0, 10);
    return (!leagueStart || d >= leagueStart) && (!leagueEnd || d <= leagueEnd);
  });
  const allInRangeSorted = [...allInRange].sort((a, b) =>
    String(a.date ?? "").localeCompare(String(b.date ?? ""))
  );
  const stints = supabaseOverride
    ? ((
        await supabase
          .from("league_rosters")
          .select(
            "user_id, wrestler_id, contract, acquired_at, released_at, acquired_at_ts, released_at_ts"
          )
          .eq("league_id", leagueId)
          .order("acquired_at", { ascending: true })
      ).data ?? []
      ).map((r) => {
        const row = r as {
          user_id: string;
          wrestler_id: string;
          contract: string | null;
          acquired_at: string;
          released_at: string | null;
          acquired_at_ts?: string | null;
          released_at_ts?: string | null;
        };
        return {
          user_id: row.user_id,
          wrestler_id: row.wrestler_id,
          contract: row.contract,
          acquired_at: String(row.acquired_at ?? "").slice(0, 10),
          released_at: row.released_at ? String(row.released_at).slice(0, 10) : null,
          acquired_at_ts: row.acquired_at_ts ? String(row.acquired_at_ts) : null,
          released_at_ts: row.released_at_ts ? String(row.released_at_ts) : null,
        };
      })
    : await getRosterStintsForLeague(leagueId);
  let wrestlerDisplayNames: Record<string, string> = {};
  if (supabaseOverride) {
    const ids = [...new Set(stints.map((s) => s.wrestler_id).filter(Boolean))];
    if (ids.length) {
      const { data: wrestlers } = await supabase.from("wrestlers").select("id, name").in("id", ids);
      wrestlerDisplayNames = Object.fromEntries(
        (wrestlers ?? []).map((w) => {
          const row = w as { id: string; name: string | null };
          return [row.id, row.name ?? row.id];
        })
      );
    }
  } else {
    wrestlerDisplayNames = await getWrestlerDisplayNamesByIds(stints.map((s) => s.wrestler_id));
  }
  const { data: brandRowsWeek } = await supabase.from("wrestlers").select("id, brand");
  const brandBySlugWeek = brandByWrestlerSlugFromRows(brandRowsWeek ?? []);
  const rosterWrestlerIds = [...new Set(stints.map((s) => s.wrestler_id))];
  const { data: rosterWrestlerRows } = rosterWrestlerIds.length
    ? await supabase.from("wrestlers").select("id, brand").in("id", rosterWrestlerIds)
    : { data: [] as Array<{ id: string; brand: string | null }> };
  const nxtRosterByWrestlerId: Record<string, boolean> = {};
  for (const w of rosterWrestlerRows ?? []) {
    nxtRosterByWrestlerId[w.id] = wrestlerRosterFromBrand(w.brand) === "NXT";
  }

  const activityRowsWeek = await fetchLeagueActivityForStintEnrichment(supabase, leagueId);
  const scoringStints = enrichRosterStintsWithActivityTimestamps(stints, activityRowsWeek);

  const { pointsByOwner } = accumulateOwnerEventPointsForCalendarWeek(
    allInRangeSorted,
    weekStartMonday,
    weekEndSunday,
    scoringStints,
    wrestlerDisplayNames,
    brandBySlugWeek,
    seasonSlug,
    nxtRosterByWrestlerId,
    includeNxt,
    sharedWrestlerPool
  );
  return pointsByOwner;
}

/** Event points per owner per wrestler for a single week (for roster breakdown in matchup view). */
export async function getPointsByOwnerByWrestlerForWeek(
  leagueId: string,
  weekStartMonday: string
): Promise<Record<string, Record<string, number>>> {
  const supabase = await createClient();
  const { data: league } = await supabase
    .from("leagues")
    .select("id, start_date, end_date, draft_date, season_slug, include_nxt, league_type")
    .eq("id", leagueId)
    .single();
  if (!league) return {};

  const leagueStart = (league.draft_date || league.start_date) ?? "";
  const weekEndSunday = getWeekEndForWeekStart(weekStartMonday, leagueStart);
  const leagueEnd = league.end_date ?? "";
  const seasonSlug = (league as { season_slug?: string | null }).season_slug ?? null;
  const includeNxt = leagueIncludesNxt(
    league as { include_nxt?: boolean | null; league_type?: string | null }
  );
  const sharedWrestlerPool = leagueUsesSalaryCap(
    (league as { league_type?: string | null }).league_type
  );

  const eventsSelectWithStart = supabase
    .from("events")
    .select("id, name, date, broadcast_start_ts, matches")
    .in("status", [...EVENT_STATUSES_FOR_SCORING])
    .order("date", { ascending: true })
    .limit(SCORING_EVENTS_FETCH_LIMIT);
  const { data: eventsWithStart, error: eventsErr } = await eventsSelectWithStart;
  const events =
    eventsWithStart ??
    (eventsErr && /column.*broadcast_start_ts does not exist/i.test(eventsErr.message ?? "")
      ? (
          await supabase
            .from("events")
            .select("id, name, date, matches")
            .in("status", [...EVENT_STATUSES_FOR_SCORING])
            .order("date", { ascending: true })
            .limit(SCORING_EVENTS_FETCH_LIMIT)
        ).data ?? []
      : []);

  const allInRange = (events ?? []).filter((e) => {
    const d = (e.date ?? "").toString().slice(0, 10);
    return (!leagueStart || d >= leagueStart) && (!leagueEnd || d <= leagueEnd);
  });
  const allInRangeSorted = [...allInRange].sort((a, b) =>
    String(a.date ?? "").localeCompare(String(b.date ?? ""))
  );
  const stints = await getRosterStintsForLeague(leagueId);
  const wrestlerDisplayNames = await getWrestlerDisplayNamesByIds(stints.map((s) => s.wrestler_id));
  const { data: brandRowsBreakdown } = await supabase.from("wrestlers").select("id, brand");
  const brandBySlugBreakdown = brandByWrestlerSlugFromRows(brandRowsBreakdown ?? []);
  const rosterWrestlerIds = [...new Set(stints.map((s) => s.wrestler_id))];
  const { data: rosterWrestlerRowsBw } = rosterWrestlerIds.length
    ? await supabase.from("wrestlers").select("id, brand").in("id", rosterWrestlerIds)
    : { data: [] as Array<{ id: string; brand: string | null }> };
  const nxtRosterByWrestlerId: Record<string, boolean> = {};
  for (const w of rosterWrestlerRowsBw ?? []) {
    nxtRosterByWrestlerId[w.id] = wrestlerRosterFromBrand(w.brand) === "NXT";
  }

  const activityRowsBw = await fetchLeagueActivityForStintEnrichment(supabase, leagueId);
  const scoringStintsBw = enrichRosterStintsWithActivityTimestamps(stints, activityRowsBw);

  const { pointsByOwnerByWrestler } = accumulateOwnerEventPointsForCalendarWeek(
    allInRangeSorted,
    weekStartMonday,
    weekEndSunday,
    scoringStintsBw,
    wrestlerDisplayNames,
    brandBySlugBreakdown,
    seasonSlug,
    nxtRosterByWrestlerId,
    includeNxt,
    sharedWrestlerPool
  );
  return pointsByOwnerByWrestler;
}

export type WeeklyMatchupResult = {
  weekStart: string;
  weekEnd: string;
  pointsByUserId: Record<string, number>;
  winnerUserId: string | null;
  beltHolderUserId: string | null;
  beltRetained: boolean;
  weeklyWinPoints: number;
  beltPoints: number;
  /** All PWBS events dated in this Mon–Sun week are `completed` (or end-of-Sunday PT when none are scheduled). */
  weekScoringFinalized: boolean;
};

const WEEKLY_WIN_BONUS = 15;
const BELT_WIN_POINTS = 5;
const BELT_RETAIN_POINTS = 4;

export function leagueUsesOwnerMatchupBonuses(leagueType: string | null | undefined): boolean {
  return leagueType === "combo" || leagueType === null;
}

export type GetLeagueWeeklyMatchupsOptions = {
  /**
   * When set, only compute this Mon–Sun week (skips other weeks).
   * Ignored for combo / default leagues: +15 and Draftastic belt bonuses depend on prior weeks.
   */
  onlyWeekStartMonday?: string | null;
};

/**
 * All weekly matchups for a league. Winner = most event points that week (tie = no winner).
 * Draftastic Championship: first week winner gets +5; same holder next week +4 retain; new winner +5.
 * Road to SummerSlam / War Games: weekly title-hold each Mon–Sun week — credits once every PWBS event
 * dated in that week is `completed` (Friday after SmackDown, weekend after a PLE, etc.). Snapshot uses the
 * calendar date of the last show in the week.
 * Other seasons: legacy full-tier points on each calendar month-end that falls in the matchup week.
 */
export async function getLeagueWeeklyMatchups(
  leagueId: string,
  supabaseOverride?: SupabaseClient,
  opts?: GetLeagueWeeklyMatchupsOptions
): Promise<WeeklyMatchupResult[]> {
  const supabase = supabaseOverride ?? (await createClient());
  const { data: league } = await supabase
    .from("leagues")
    .select("id, start_date, end_date, draft_date, league_type, season_slug")
    .eq("id", leagueId)
    .single();
  if (!league) return [];

  const start = (league.draft_date || league.start_date) ?? "";
  const end = league.end_date ?? "";
  if (!start || !end) return [];

  const leagueType = (league as { league_type?: string | null }).league_type ?? null;
  const seasonSlug = (league as { season_slug?: string | null }).season_slug ?? null;
  const useOwnerMatchupBonuses = leagueUsesOwnerMatchupBonuses(leagueType);
  const useWeeklyBelt = leagueUsesWeeklyPstBeltHold(seasonSlug);
  /** Title-hold (monthly or weekly RTS) belt points — must run for season_overall too so per-week totals match `getLeagueScoring` / faction scoreboard. Owner matchup bonuses (+15 / Draftastic belt) stay gated by `leagueUsesOwnerMatchupBonuses`. */
  const includeMonthlyBeltInMatchup =
    leagueType === "head_to_head" ||
    leagueType === "season_overall" ||
    leagueType === "salary_cap" ||
    leagueType === "combo" ||
    leagueType === null;

  let reigns: Array<{
    champion_slug?: string | null;
    champion_id?: string | null;
    champion?: string | null;
    champion_name?: string | null;
    title?: string | null;
    title_name?: string | null;
    won_date?: string | null;
    start_date?: string | null;
    lost_date?: string | null;
    end_date?: string | null;
  }> = [];
  let firstEligibleWeekEndSunday = "9999-12-31";
  let firstEligibleMonthEnd = "9999-12-31";
  let useBroadcastForMonthlyBelt = false;
  /** Populated when belt reign inference runs; used for weekly snapshot + completion gate (RTS). */
  let beltEventsForWeeklyLock: Array<{ name: string | null; date: string | null; id: string; status?: string | null }> =
    [];

  if (includeMonthlyBeltInMatchup) {
    if (useWeeklyBelt) {
      firstEligibleWeekEndSunday = firstEligibleWeekEndSundayForLeagueStart(start);
    } else {
      firstEligibleMonthEnd = firstLegacyCalendarMonthEndEligibleForLeagueStart(start);
    }

    const beltEventStatuses = useWeeklyBelt ? EVENT_STATUSES_FOR_WEEK_SCHEDULE : [...EVENT_STATUSES_FOR_SCORING];

    /** Belt inference must see the full event timeline in range; explicit limit avoids PostgREST default ~1000 oldest rows. */
    const [{ data: tableReigns }, eventsRes, changesRes] = await Promise.all([
      supabase.from("championship_history").select("*"),
      supabase
        .from("events")
        .select("id, name, date, matches, broadcast_start_ts, status")
        .in("status", [...beltEventStatuses])
        .gte("date", BELT_REIGN_INFERENCE_EVENTS_FROM)
        .lte("date", end)
        .order("date", { ascending: true })
        .limit(SCORING_EVENTS_FETCH_LIMIT),
      supabase
        .from(CHAMPIONSHIP_CHANGES_TABLE_NAME)
        .select("championship_type, champion, champion_slug, date")
        .order("date", { ascending: true }),
    ]);
    type EventRowForReignInference = Parameters<typeof inferReignsFromEvents>[0][number];
    let eventsInRange = (eventsRes.data ?? []) as EventRowForReignInference[];
    if (
      eventsRes.error &&
      /column.*broadcast_start_ts does not exist/i.test(eventsRes.error.message ?? "")
    ) {
      const { data: ev2 } = await supabase
        .from("events")
        .select("id, name, date, matches, status")
        .in("status", [...beltEventStatuses])
        .gte("date", BELT_REIGN_INFERENCE_EVENTS_FROM)
        .lte("date", end)
        .order("date", { ascending: true })
        .limit(SCORING_EVENTS_FETCH_LIMIT);
      eventsInRange = (ev2 ?? []) as EventRowForReignInference[];
    }
    useBroadcastForMonthlyBelt = eventsInRange.some((e) => getEventBroadcastStartMs(e) != null);
    const changesRows = changesRes.error ? [] : (changesRes.data ?? []);
    const changesReigns = inferReignsFromChampionshipChanges(changesRows);
    let eventsForInference: EventRowForReignInference[] = eventsInRange;
    if (useWeeklyBelt) {
      eventsForInference = eventsInRange.filter((e) => {
        const s = String((e as { status?: string | null }).status ?? "").toLowerCase();
        return s === "live" || s === "completed";
      });
    }
    const inferredReigns = inferReignsFromEvents(eventsForInference);
    reigns = mergeReigns(tableReigns ?? [], [...inferredReigns, ...changesReigns]) as typeof reigns;
    beltEventsForWeeklyLock = eventsInRange as Array<{
      name: string | null;
      date: string | null;
      id: string;
      status?: string | null;
    }>;
  }

  const weeksAll = getWeeksInRange(start, end);
  const only = opts?.onlyWeekStartMonday?.trim().slice(0, 10) ?? "";
  const weeks =
    only &&
    /^\d{4}-\d{2}-\d{2}$/.test(only) &&
    weeksAll.includes(only) &&
    !useOwnerMatchupBonuses
      ? [only]
      : weeksAll;
  const results: WeeklyMatchupResult[] = [];
  let beltHolder: string | null = null;
  const today = new Date().toISOString().slice(0, 10);
  const stints = includeMonthlyBeltInMatchup
    ? supabaseOverride
      ? ((
          await supabase
            .from("league_rosters")
            .select(
              "user_id, wrestler_id, contract, acquired_at, released_at, acquired_at_ts, released_at_ts"
            )
            .eq("league_id", leagueId)
            .order("acquired_at", { ascending: true })
        ).data ?? []
        ).map((r) => {
          const row = r as {
            user_id: string;
            wrestler_id: string;
            contract: string | null;
            acquired_at: string;
            released_at: string | null;
            acquired_at_ts?: string | null;
            released_at_ts?: string | null;
          };
          return {
            user_id: row.user_id,
            wrestler_id: row.wrestler_id,
            contract: row.contract,
            acquired_at: String(row.acquired_at ?? "").slice(0, 10),
            released_at: row.released_at ? String(row.released_at).slice(0, 10) : null,
            acquired_at_ts: row.acquired_at_ts ? String(row.acquired_at_ts) : null,
            released_at_ts: row.released_at_ts ? String(row.released_at_ts) : null,
          };
        })
      : await getRosterStintsForLeague(leagueId)
    : [];
  const activityRowsMatchups =
    includeMonthlyBeltInMatchup && stints.length > 0
      ? await fetchLeagueActivityForStintEnrichment(supabase, leagueId)
      : [];
  const scoringStints =
    activityRowsMatchups.length > 0
      ? enrichRosterStintsWithActivityTimestamps(stints, activityRowsMatchups)
      : stints;
  const monthlyBeltNameByWrestler =
    includeMonthlyBeltInMatchup && scoringStints.length > 0
      ? supabaseOverride
        ? Object.fromEntries(
            (
              (
                await supabase
                  .from("wrestlers")
                  .select("id, name")
                  .in("id", [...new Set(scoringStints.map((s) => s.wrestler_id).filter(Boolean))])
              ).data ?? []
            ).map((w) => {
              const row = w as { id: string; name: string | null };
              return [row.id, row.name ?? row.id];
            })
          )
        : await getWrestlerDisplayNamesByIds([...new Set(scoringStints.map((s) => s.wrestler_id))])
      : {};

  for (const weekStart of weeks) {
    const weekEnd = getWeekEndForWeekStart(weekStart, start);
    let pointsByUserId = await getPointsByOwnerForLeagueForWeek(leagueId, weekStart, supabase);

    if (includeMonthlyBeltInMatchup && reigns.length > 0) {
      if (useWeeklyBelt) {
        const lastBeltWeekEnd = beltScoringLastWeekEndSundayInclusive(end);
        const leagueStartYmd = start.slice(0, 10);
        const leagueEndYmd = end.slice(0, 10);
        const beltLockYmd = weeklyBeltSnapshotYmdForWeek(
          beltEventsForWeeklyLock,
          weekStart,
          weekEnd,
          leagueStartYmd,
          leagueEndYmd
        );
        const inLeagueBeltWindow =
          weekEnd >= firstEligibleWeekEndSunday &&
          (!lastBeltWeekEnd || weekEnd <= lastBeltWeekEnd) &&
          fantasyWeekBeltScoringUnlocked(
            beltEventsForWeeklyLock,
            weekStart,
            weekEnd,
            leagueStartYmd,
            leagueEndYmd
          );

        if (inLeagueBeltWindow) {
          const beltBySlug = computeWeeklyBeltHoldPointsForWeekEndSunday(
            reigns,
            beltLockYmd,
            firstEligibleWeekEndSunday,
            weekEnd
          );
          for (const s of scoringStints) {
            const lockEvent = beltEventsForWeeklyLock.find(
              (e) => String(e.date ?? "").slice(0, 10) === beltLockYmd
            );
            const lockBroadcastMs = lockEvent ? getEventBroadcastStartMs(lockEvent) : null;
            if (
              !rosterStintActiveForWeeklyBeltHold({
                stint: s,
                weekEndYmd: beltLockYmd,
                useBroadcastStart: useBroadcastForMonthlyBelt,
                broadcastStartMs: lockBroadcastMs ?? undefined,
              })
            ) {
              continue;
            }
            const pts = sumMonthlyBeltPointsForStint(
              beltBySlug,
              s.wrestler_id,
              monthlyBeltNameByWrestler[s.wrestler_id],
              beltLockYmd
            );
            if (pts > 0) {
              pointsByUserId[s.user_id] =
                (pointsByUserId[s.user_id] ?? 0) + pts;
            }
          }
        }
      } else {
        const monthEndInWeek = getMonthEndInWeek(weekStart, weekEnd);
        if (
          monthEndInWeek &&
          monthEndInWeek >= firstEligibleMonthEnd &&
          monthEndInWeek < today &&
          !shouldSkipJulyMonthEndBeltForRts2026(monthEndInWeek, end)
        ) {
          const beltBySlug = computeEndOfMonthBeltPointsForSingleMonth(
            reigns,
            monthEndInWeek,
            firstEligibleMonthEnd
          );
          for (const s of scoringStints) {
            if (
              !rosterStintActiveForMonthEndBelt({
                stint: s,
                monthEndYmd: monthEndInWeek,
                useBroadcastStart: useBroadcastForMonthlyBelt,
              })
            ) {
              continue;
            }
            const pts = sumMonthlyBeltPointsForStint(
              beltBySlug,
              s.wrestler_id,
              monthlyBeltNameByWrestler[s.wrestler_id],
              monthEndInWeek
            );
            if (pts > 0) {
              pointsByUserId[s.user_id] =
                (pointsByUserId[s.user_id] ?? 0) + pts;
            }
          }
        }

        if (
          isRoadToSummerSlam2026WithSummerslamFinale(end) &&
          today > RTS_2026_LEAGUE_END_DATE &&
          weekStart <= RTS_2026_LEAGUE_END_DATE &&
          weekEnd >= RTS_2026_LEAGUE_END_DATE
        ) {
          const beltBySlug = computeEndOfMonthBeltPointsForSingleMonth(
            reigns,
            RTS_2026_LEAGUE_END_DATE,
            firstEligibleMonthEnd
          );
          for (const s of scoringStints) {
            if (
              !rosterStintActiveForMonthEndBelt({
                stint: s,
                monthEndYmd: RTS_2026_LEAGUE_END_DATE,
                useBroadcastStart: useBroadcastForMonthlyBelt,
              })
            ) {
              continue;
            }
            const pts = sumMonthlyBeltPointsForStint(
              beltBySlug,
              s.wrestler_id,
              monthlyBeltNameByWrestler[s.wrestler_id],
              RTS_2026_LEAGUE_END_DATE
            );
            if (pts > 0) {
              pointsByUserId[s.user_id] =
                (pointsByUserId[s.user_id] ?? 0) + pts;
            }
          }
        }
      }
    }

    const leagueStartYmd = start.slice(0, 10);
    const leagueEndYmd = end.slice(0, 10);
    const weekScoringFinalized = fantasyWeekBeltScoringUnlocked(
      beltEventsForWeeklyLock,
      weekStart,
      weekEnd,
      leagueStartYmd,
      leagueEndYmd
    );

    let winnerUserId: string | null = null;
    let beltHolderUserId: string | null = null;
    let beltRetained = false;
    let beltPoints = 0;
    let weeklyWinPoints = 0;

    if (weekScoringFinalized && useOwnerMatchupBonuses) {
      const userIds = Object.keys(pointsByUserId);
      const maxPoints = Math.max(0, ...Object.values(pointsByUserId));
      const winners = userIds.filter((id) => pointsByUserId[id] === maxPoints && maxPoints > 0);
      winnerUserId = winners.length === 1 ? winners[0]! : null;

      if (winnerUserId) {
        weeklyWinPoints = WEEKLY_WIN_BONUS;
        if (beltHolder === null) {
          beltHolderUserId = winnerUserId;
          beltHolder = winnerUserId;
          beltPoints = BELT_WIN_POINTS;
        } else if (beltHolder === winnerUserId) {
          beltHolderUserId = winnerUserId;
          beltRetained = true;
          beltPoints = BELT_RETAIN_POINTS;
        } else {
          beltHolderUserId = winnerUserId;
          beltHolder = winnerUserId;
          beltPoints = BELT_WIN_POINTS;
        }
      }
    }

    results.push({
      weekStart,
      weekEnd,
      pointsByUserId,
      winnerUserId,
      beltHolderUserId,
      beltRetained,
      weeklyWinPoints,
      beltPoints,
      weekScoringFinalized,
    });
  }

  return results;
}

/**
 * Per-owner points for one Mon–Sun week exactly as on the league matchups chart: event points, title-hold belt
 * credited in that week (RTS weekly lock or legacy month-end in the week), and for combo / default leagues
 * weekly high (+15) plus Draftastic belt (+5 / +4 retain) when the week is over.
 */
export async function getPointsByOwnerForLeagueWeekFromMatchups(
  leagueId: string,
  weekStartMonday: string,
  supabaseOverride?: SupabaseClient
): Promise<Record<string, number>> {
  const matchups = await getLeagueWeeklyMatchups(leagueId, supabaseOverride, {
    onlyWeekStartMonday: weekStartMonday,
  });
  const m = matchups.find((x) => x.weekStart === weekStartMonday);
  if (!m) return {};
  const out: Record<string, number> = { ...m.pointsByUserId };
  if (m.winnerUserId) {
    out[m.winnerUserId] = (out[m.winnerUserId] ?? 0) + m.weeklyWinPoints;
  }
  if (m.beltHolderUserId) {
    out[m.beltHolderUserId] = (out[m.beltHolderUserId] ?? 0) + m.beltPoints;
  }
  return out;
}

/**
 * Title-hold belt points by wrestler slug for the given Mon–Sun week (weekly PST for RTS; legacy month-end otherwise).
 */
export async function getMonthlyBeltBySlugForWeek(
  leagueId: string,
  weekStartMonday: string
): Promise<Record<string, number>> {
  const weekEndSunday = getSundayOfWeek(weekStartMonday);

  const supabase = await createClient();
  const { data: league } = await supabase
    .from("leagues")
    .select("id, start_date, end_date, draft_date, league_type, season_slug")
    .eq("id", leagueId)
    .single();
  if (!league) return {};

  const leagueType = (league as { league_type?: string | null }).league_type ?? null;
  const include =
    leagueType === "head_to_head" || leagueType === "combo" || leagueType === null;
  if (!include) return {};

  const start = (league.draft_date || league.start_date) ?? "";
  const end = league.end_date ?? "";
  const seasonSlug = (league as { season_slug?: string | null }).season_slug ?? null;
  const useWeeklyBelt = leagueUsesWeeklyPstBeltHold(seasonSlug);
  if (!useWeeklyBelt) {
    const monthEndInWeek = getMonthEndInWeek(weekStartMonday, weekEndSunday);
    const seasonEndSnapshot = legacySeasonEndBeltSnapshotYmd(end);
    const seasonEndInWeek =
      seasonEndSnapshot &&
      seasonEndSnapshot >= weekStartMonday &&
      seasonEndSnapshot <= weekEndSunday
        ? seasonEndSnapshot
        : null;
    const beltLockInWeek = monthEndInWeek ?? seasonEndInWeek;
    const firstEligibleMonthEnd = firstLegacyCalendarMonthEndEligibleForLeagueStart(start);
    if (
      !beltLockInWeek ||
      beltLockInWeek < firstEligibleMonthEnd ||
      !isPastEndOfDayPst(beltLockInWeek) ||
      shouldSkipJulyMonthEndBeltForRts2026(beltLockInWeek, end)
    ) {
      return {};
    }
  }

  const beltEventStatuses = useWeeklyBelt ? EVENT_STATUSES_FOR_WEEK_SCHEDULE : [...EVENT_STATUSES_FOR_SCORING];
  const beltEventSelect = "id, name, date, matches, status";

  const [{ data: tableReigns }, { data: eventsInRange }, changesRes] = await Promise.all([
    supabase.from("championship_history").select("*"),
    supabase
      .from("events")
      .select(beltEventSelect)
      .in("status", [...beltEventStatuses])
      .gte("date", BELT_REIGN_INFERENCE_EVENTS_FROM)
      .lte("date", end)
      .order("date", { ascending: true })
      .limit(SCORING_EVENTS_FETCH_LIMIT),
    supabase
      .from(CHAMPIONSHIP_CHANGES_TABLE_NAME)
      .select("championship_type, champion, champion_slug, date")
      .order("date", { ascending: true }),
  ]);
  const changesRows = changesRes.error ? [] : (changesRes.data ?? []);
  const changesReigns = inferReignsFromChampionshipChanges(changesRows);
  let evForInfer = eventsInRange ?? [];
  if (useWeeklyBelt) {
    evForInfer = (eventsInRange ?? []).filter((e) => {
      const s = String((e as { status?: string | null }).status ?? "").toLowerCase();
      return s === "live" || s === "completed";
    });
  }
  const inferredReigns = inferReignsFromEvents(evForInfer);
  const reigns = mergeReigns(tableReigns ?? [], [...inferredReigns, ...changesReigns]) as Array<{
    champion_slug?: string | null;
    champion_id?: string | null;
    champion?: string | null;
    champion_name?: string | null;
    title?: string | null;
    title_name?: string | null;
    won_date?: string | null;
    start_date?: string | null;
    lost_date?: string | null;
    end_date?: string | null;
  }>;
  if (!reigns.length) return {};

  if (useWeeklyBelt) {
    const firstEligibleWeekEndSunday = firstEligibleWeekEndSundayForLeagueStart(start);
    const lastBeltWeekEnd = beltScoringLastWeekEndSundayInclusive(end);
    const evRows = (eventsInRange ?? []) as Array<{
      name: string | null;
      date: string | null;
      id: string;
      status?: string | null;
    }>;
    const leagueStartYmd = start.slice(0, 10);
    const leagueEndYmd = end.slice(0, 10);
    const beltLockYmd = weeklyBeltSnapshotYmdForWeek(
      evRows,
      weekStartMonday,
      weekEndSunday,
      leagueStartYmd,
      leagueEndYmd
    );
    if (
      weekEndSunday < firstEligibleWeekEndSunday ||
      (lastBeltWeekEnd && weekEndSunday > lastBeltWeekEnd) ||
      !fantasyWeekBeltScoringUnlocked(evRows, weekStartMonday, weekEndSunday, leagueStartYmd, leagueEndYmd)
    ) {
      return {};
    }
    return computeWeeklyBeltHoldPointsForWeekEndSunday(
      reigns,
      beltLockYmd,
      firstEligibleWeekEndSunday,
      weekEndSunday
    );
  }
  const monthEndInWeek = getMonthEndInWeek(weekStartMonday, weekEndSunday);
  const seasonEndSnapshot = legacySeasonEndBeltSnapshotYmd(end);
  const beltLockYmd =
    monthEndInWeek ??
    (seasonEndSnapshot &&
    seasonEndSnapshot >= weekStartMonday &&
    seasonEndSnapshot <= weekEndSunday
      ? seasonEndSnapshot
      : null);
  if (!beltLockYmd) return {};
  const bySlug = computeEndOfMonthBeltPointsForSingleMonth(
    reigns,
    beltLockYmd,
    firstLegacyCalendarMonthEndEligibleForLeagueStart(start)
  );
  if (seasonEndSnapshot && beltLockYmd === seasonEndSnapshot) {
    const currentBySlug = await getCurrentChampionsMonthlyBeltBySlug(supabase);
    for (const [slug, pts] of Object.entries(currentBySlug)) {
      if (!Number.isFinite(pts) || pts <= 0) continue;
      bySlug[slug] = Math.max(bySlug[slug] ?? 0, pts);
    }
  }
  return bySlug;
}

/** Total bonus points per owner (weekly win +15 and belt +5/+4) for standings. */
export async function getWeeklyBonusesByOwner(
  leagueId: string,
  supabaseOverride?: SupabaseClient
): Promise<Record<string, number>> {
  const matchups = await getLeagueWeeklyMatchups(leagueId, supabaseOverride);
  const bonuses: Record<string, number> = {};
  for (const m of matchups) {
    if (m.winnerUserId) {
      bonuses[m.winnerUserId] = (bonuses[m.winnerUserId] ?? 0) + m.weeklyWinPoints;
    }
    if (m.beltHolderUserId) {
      bonuses[m.beltHolderUserId] = (bonuses[m.beltHolderUserId] ?? 0) + m.beltPoints;
    }
  }
  return bonuses;
}

/** One matchup in a week: either H2H (2 teams) or Triple Threat (3 teams). */
export type WeekMatchup = {
  type: "h2h" | "triple";
  userIds: string[];
};

/**
 * Assign members to H2H and Triple Threat matchups for a week.
 * Uses deterministic order (user_id sort). Even N: N/2 H2H. Odd N: 1 triple + (N-3)/2 H2H.
 */
export function getMatchupsForWeek(
  memberUserIds: string[],
  teamCount: number
): WeekMatchup[] {
  const structure = getWeeklyMatchupStructure(teamCount);
  if (!structure || memberUserIds.length !== teamCount) return [];
  const sorted = [...memberUserIds].sort((a, b) => a.localeCompare(b));
  const out: WeekMatchup[] = [];
  let idx = 0;
  for (let t = 0; t < structure.numTripleThreat; t++) {
    out.push({ type: "triple", userIds: sorted.slice(idx, idx + 3) });
    idx += 3;
  }
  for (let h = 0; h < structure.numH2H; h++) {
    out.push({ type: "h2h", userIds: sorted.slice(idx, idx + 2) });
    idx += 2;
  }
  return out;
}

export async function getXpSeededMemberUserIds(
  memberUserIds: string[],
  supabaseOverride?: SupabaseClient
): Promise<string[]> {
  const ids = [...new Set(memberUserIds)].filter(Boolean);
  if (ids.length === 0) return [];
  const fallback = [...ids].sort((a, b) => a.localeCompare(b));
  const supabase = supabaseOverride ?? (await createClient());
  const { data, error } = await supabase
    .from("user_xp_state")
    .select("user_id, total_xp")
    .in("user_id", ids);
  if (error) return fallback;
  const xpByUserId = new Map<string, number>();
  for (const row of (data ?? []) as Array<{ user_id?: string | null; total_xp?: number | null }>) {
    const uid = row.user_id ?? "";
    if (!uid) continue;
    xpByUserId.set(uid, Number(row.total_xp ?? 0));
  }
  return [...ids].sort((a, b) => {
    const axp = xpByUserId.get(a) ?? 0;
    const bxp = xpByUserId.get(b) ?? 0;
    if (bxp !== axp) return bxp - axp;
    return a.localeCompare(b);
  });
}

/**
 * Even-length 1-factorization via the circle method: for a list of `m` ids (m even),
 * returns the m/2 pairings for `roundIndex`. Rotating roundIndex 0..m-2 yields a full
 * single round-robin (each pair exactly once).
 */
function circleRoundRobinPairs(ids: string[], roundIndex: number): Array<[string, string]> {
  const m = ids.length;
  if (m < 2 || m % 2 !== 0) return [];
  const rounds = m - 1;
  const r = ((roundIndex % rounds) + rounds) % rounds;
  const rest = ids.slice(1);
  const rotated: string[] = [];
  for (let i = 0; i < rest.length; i++) rotated.push(rest[(i + r) % rest.length]!);
  const row = [ids[0]!, ...rotated];
  const pairs: Array<[string, string]> = [];
  for (let i = 0; i < m / 2; i++) pairs.push([row[i]!, row[m - 1 - i]!]);
  return pairs;
}

/**
 * Weekly regular-season matchups for a rotating round-robin.
 * - Even N: N/2 head-to-head games (no byes, no triple threats).
 * - Odd N: exactly one triple threat + (N-3)/2 head-to-head games, using the circle
 *   method with a rotating "bye" folded into a triple threat of three consecutive
 *   teams. This guarantees each team lands in the triple threat exactly three times
 *   per N-week cycle, so triple-threat duty is spread evenly (no team is always in one).
 * `order` is the seeded member order (fixed across the season for determinism).
 */
export function getRegularSeasonMatchupsForRound(order: string[], roundIndex: number): WeekMatchup[] {
  const n = order.length;
  if (n < 3) return [];
  if (n % 2 === 0) {
    return circleRoundRobinPairs(order, roundIndex).map((p) => ({ type: "h2h", userIds: [p[0], p[1]] }));
  }
  const r = ((roundIndex % n) + n) % n;
  const at = (k: number) => order[(((r + k) % n) + n) % n]!;
  const half = (n - 1) / 2;
  // The would-be "bye" team (r) plus the k=1 pair become a triple of 3 consecutive teams.
  const out: WeekMatchup[] = [{ type: "triple", userIds: [at(-1), at(0), at(1)] }];
  for (let k = 2; k <= half; k++) {
    out.push({ type: "h2h", userIds: [at(k), at(-k)] });
  }
  return out;
}

function winnerByPointsThenSeed(
  pointsByUserId: Record<string, number>,
  a: string,
  b: string,
  seededOrder: string[]
): string {
  const pa = pointsByUserId[a] ?? 0;
  const pb = pointsByUserId[b] ?? 0;
  if (pa > pb) return a;
  if (pb > pa) return b;
  return seededOrder.indexOf(a) <= seededOrder.indexOf(b) ? a : b;
}

/** Apply one week's matchup (H2H or triple threat) to a running W-L-T tally. */
function applyMatchupToWlt(
  mu: WeekMatchup,
  pointsByUserId: Record<string, number>,
  wlt: Record<string, { w: number; l: number; t: number }>
): void {
  if (mu.type === "h2h") {
    const [a, b] = mu.userIds;
    if (!a || !b || !wlt[a] || !wlt[b]) return;
    const pa = pointsByUserId[a] ?? 0;
    const pb = pointsByUserId[b] ?? 0;
    if (pa > pb) {
      wlt[a]!.w++;
      wlt[b]!.l++;
    } else if (pb > pa) {
      wlt[b]!.w++;
      wlt[a]!.l++;
    } else {
      wlt[a]!.t++;
      wlt[b]!.t++;
    }
    return;
  }
  const pts = mu.userIds
    .filter((id) => wlt[id])
    .map((id) => ({ id, p: pointsByUserId[id] ?? 0 }))
    .sort((x, y) => y.p - x.p);
  if (pts.length < 3) return;
  const [x, y, z] = pts;
  if (x!.p > y!.p) {
    wlt[x!.id]!.w++;
    wlt[y!.id]!.l++;
    wlt[z!.id]!.l++;
    if (y!.p === z!.p) {
      // second/third tie: both charged a loss (already applied above).
    }
  } else if (x!.p === y!.p && y!.p > z!.p) {
    wlt[x!.id]!.t++;
    wlt[y!.id]!.t++;
    wlt[z!.id]!.l++;
  } else {
    wlt[x!.id]!.t++;
    wlt[y!.id]!.t++;
    wlt[z!.id]!.t++;
  }
}

/**
 * Seed managers by regular-season record (wins, then fewer losses, then ties),
 * breaking ties on total points then the base (XP) order. Works for any league size
 * and any number of regular-season weeks, using the rotating round-robin schedule.
 */
function buildRegularSeasonSeeds(
  order: string[],
  regularSeasonWeekStarts: string[],
  weeklyResults: WeeklyMatchupResult[]
): string[] {
  const wlt: Record<string, { w: number; l: number; t: number }> = Object.fromEntries(
    order.map((id) => [id, { w: 0, l: 0, t: 0 }])
  );
  const pointsTotal: Record<string, number> = Object.fromEntries(order.map((id) => [id, 0]));
  for (let i = 0; i < regularSeasonWeekStarts.length; i++) {
    const weekStart = regularSeasonWeekStarts[i]!;
    const weekResult = weeklyResults.find((r) => r.weekStart === weekStart);
    if (!weekResult) continue;
    for (const id of order) pointsTotal[id] = (pointsTotal[id] ?? 0) + (weekResult.pointsByUserId[id] ?? 0);
    for (const mu of getRegularSeasonMatchupsForRound(order, i)) {
      applyMatchupToWlt(mu, weekResult.pointsByUserId, wlt);
    }
  }
  const baseIndex = new Map(order.map((id, i) => [id, i]));
  return [...order].sort((a, b) => {
    const wa = wlt[a]!;
    const wb = wlt[b]!;
    if (wb.w !== wa.w) return wb.w - wa.w;
    if (wa.l !== wb.l) return wa.l - wb.l;
    if (wb.t !== wa.t) return wb.t - wa.t;
    if ((pointsTotal[b] ?? 0) !== (pointsTotal[a] ?? 0)) return (pointsTotal[b] ?? 0) - (pointsTotal[a] ?? 0);
    return (baseIndex.get(a) ?? 0) - (baseIndex.get(b) ?? 0);
  });
}

// ============================================================================
// H2H playoffs (sizes 4–8), anchored to the final fantasy week.
// The regular season is every week before the playoff rounds (variable length).
// ============================================================================

/** Head-to-Head leagues with a supported playoff bracket size. */
export function leagueSupportsH2HPlayoffs(size: number): boolean {
  return size >= 4 && size <= 8;
}

/** Number of playoff weeks (rounds) for a given league size. 4 = 2 weeks; 5–8 = 3 weeks. */
export function playoffRoundsForSize(size: number): number {
  if (!leagueSupportsH2HPlayoffs(size)) return 0;
  return size === 4 ? 2 : 3;
}

/** Human labels for each playoff round (index 0 = first playoff week). */
function playoffRoundLabels(size: number): string[] {
  const po = playoffRoundsForSize(size);
  if (po === 2) return ["Semifinals", "Finals"];
  if (po === 3) {
    const first = size === 5 ? "First Round" : "Quarterfinals";
    return [first, "Semifinals", "Finals"];
  }
  return [];
}

type PlayoffRef =
  | { kind: "seed"; seed: number }
  | { kind: "win"; game: string }
  | { kind: "lose"; game: string };

const seedRef = (seed: number): PlayoffRef => ({ kind: "seed", seed });
const winRef = (game: string): PlayoffRef => ({ kind: "win", game });
const loseRef = (game: string): PlayoffRef => ({ kind: "lose", game });

type PlayoffGameSpec = {
  id: string;
  round: number;
  a: PlayoffRef;
  b: PlayoffRef;
  group: "championship" | "placement";
  label: string;
};

type PlayoffSpec = {
  size: number;
  rounds: number;
  games: PlayoffGameSpec[];
  /** Teams that get a final rank with no game (single team left for a place). */
  autoPlacements?: Array<{ rank: number; label: string; ref: PlayoffRef }>;
};

/**
 * Bracket templates per league size. All games are 1v1; top seeds get byes in early
 * rounds. Championship games decide 1st/2nd; placement games rank everyone else.
 * Every size finishes within `playoffRoundsForSize(size)` weeks.
 */
const PLAYOFF_SPECS: Record<number, PlayoffSpec> = {
  4: {
    size: 4,
    rounds: 2,
    games: [
      { id: "sf1", round: 0, a: seedRef(1), b: seedRef(4), group: "championship", label: "Semifinal" },
      { id: "sf2", round: 0, a: seedRef(2), b: seedRef(3), group: "championship", label: "Semifinal" },
      { id: "final", round: 1, a: winRef("sf1"), b: winRef("sf2"), group: "championship", label: "Championship" },
      { id: "third", round: 1, a: loseRef("sf1"), b: loseRef("sf2"), group: "placement", label: "3rd Place" },
    ],
  },
  5: {
    size: 5,
    rounds: 3,
    games: [
      { id: "pi", round: 0, a: seedRef(4), b: seedRef(5), group: "championship", label: "First Round" },
      { id: "sf1", round: 1, a: seedRef(1), b: winRef("pi"), group: "championship", label: "Semifinal" },
      { id: "sf2", round: 1, a: seedRef(2), b: seedRef(3), group: "championship", label: "Semifinal" },
      { id: "final", round: 2, a: winRef("sf1"), b: winRef("sf2"), group: "championship", label: "Championship" },
      { id: "third", round: 2, a: loseRef("sf1"), b: loseRef("sf2"), group: "placement", label: "3rd Place" },
    ],
    autoPlacements: [{ rank: 5, label: "5th Place", ref: loseRef("pi") }],
  },
  6: {
    size: 6,
    rounds: 3,
    games: [
      { id: "q1", round: 0, a: seedRef(3), b: seedRef(6), group: "championship", label: "Quarterfinal" },
      { id: "q2", round: 0, a: seedRef(4), b: seedRef(5), group: "championship", label: "Quarterfinal" },
      { id: "sf1", round: 1, a: seedRef(1), b: winRef("q2"), group: "championship", label: "Semifinal" },
      { id: "sf2", round: 1, a: seedRef(2), b: winRef("q1"), group: "championship", label: "Semifinal" },
      { id: "final", round: 2, a: winRef("sf1"), b: winRef("sf2"), group: "championship", label: "Championship" },
      { id: "third", round: 2, a: loseRef("sf1"), b: loseRef("sf2"), group: "placement", label: "3rd Place" },
      { id: "fifth", round: 2, a: loseRef("q1"), b: loseRef("q2"), group: "placement", label: "5th Place" },
    ],
  },
  7: {
    size: 7,
    rounds: 3,
    games: [
      { id: "q1", round: 0, a: seedRef(4), b: seedRef(5), group: "championship", label: "Quarterfinal" },
      { id: "q2", round: 0, a: seedRef(2), b: seedRef(7), group: "championship", label: "Quarterfinal" },
      { id: "q3", round: 0, a: seedRef(3), b: seedRef(6), group: "championship", label: "Quarterfinal" },
      { id: "sf1", round: 1, a: seedRef(1), b: winRef("q1"), group: "championship", label: "Semifinal" },
      { id: "sf2", round: 1, a: winRef("q2"), b: winRef("q3"), group: "championship", label: "Semifinal" },
      { id: "cs", round: 1, a: loseRef("q2"), b: loseRef("q3"), group: "placement", label: "5th Place Semifinal" },
      { id: "final", round: 2, a: winRef("sf1"), b: winRef("sf2"), group: "championship", label: "Championship" },
      { id: "third", round: 2, a: loseRef("sf1"), b: loseRef("sf2"), group: "placement", label: "3rd Place" },
      { id: "fifth", round: 2, a: loseRef("q1"), b: winRef("cs"), group: "placement", label: "5th Place" },
    ],
    autoPlacements: [{ rank: 7, label: "7th Place", ref: loseRef("cs") }],
  },
  8: {
    size: 8,
    rounds: 3,
    games: [
      { id: "q1", round: 0, a: seedRef(1), b: seedRef(8), group: "championship", label: "Quarterfinal" },
      { id: "q2", round: 0, a: seedRef(4), b: seedRef(5), group: "championship", label: "Quarterfinal" },
      { id: "q3", round: 0, a: seedRef(2), b: seedRef(7), group: "championship", label: "Quarterfinal" },
      { id: "q4", round: 0, a: seedRef(3), b: seedRef(6), group: "championship", label: "Quarterfinal" },
      { id: "sf1", round: 1, a: winRef("q1"), b: winRef("q2"), group: "championship", label: "Semifinal" },
      { id: "sf2", round: 1, a: winRef("q3"), b: winRef("q4"), group: "championship", label: "Semifinal" },
      { id: "cs1", round: 1, a: loseRef("q1"), b: loseRef("q2"), group: "placement", label: "Consolation Semifinal" },
      { id: "cs2", round: 1, a: loseRef("q3"), b: loseRef("q4"), group: "placement", label: "Consolation Semifinal" },
      { id: "final", round: 2, a: winRef("sf1"), b: winRef("sf2"), group: "championship", label: "Championship" },
      { id: "third", round: 2, a: loseRef("sf1"), b: loseRef("sf2"), group: "placement", label: "3rd Place" },
      { id: "fifth", round: 2, a: winRef("cs1"), b: winRef("cs2"), group: "placement", label: "5th Place" },
      { id: "seventh", round: 2, a: loseRef("cs1"), b: loseRef("cs2"), group: "placement", label: "7th Place" },
    ],
  },
};

function getPlayoffSpec(size: number): PlayoffSpec | null {
  return PLAYOFF_SPECS[size] ?? null;
}

type ResolvedPlayoffGame = {
  spec: PlayoffGameSpec;
  a: string | null;
  b: string | null;
  weekStart: string;
  weekEnd: string;
  weekResult: WeeklyMatchupResult | undefined;
  weekFinalized: boolean;
  winner: string | null;
  loser: string | null;
};

/** Resolve every playoff game's participants + winners from seeds and weekly results. */
function resolvePlayoffGames(params: {
  spec: PlayoffSpec;
  seeds: string[];
  playoffWeekStarts: string[];
  weeklyResults: WeeklyMatchupResult[];
}): Map<string, ResolvedPlayoffGame> {
  const { spec, seeds, playoffWeekStarts, weeklyResults } = params;
  const resolved = new Map<string, ResolvedPlayoffGame>();
  const resolveRef = (ref: PlayoffRef): string | null => {
    if (ref.kind === "seed") return seeds[ref.seed - 1] ?? null;
    const g = resolved.get(ref.game);
    if (!g) return null;
    return ref.kind === "win" ? g.winner : g.loser;
  };
  const games = [...spec.games].sort((g1, g2) => g1.round - g2.round);
  for (const g of games) {
    const a = resolveRef(g.a);
    const b = resolveRef(g.b);
    const weekStart = playoffWeekStarts[g.round] ?? "";
    const weekEnd = weekStart ? getSundayOfWeek(weekStart) : "";
    const weekResult = weekStart ? weeklyResults.find((r) => r.weekStart === weekStart) : undefined;
    const weekFinalized = Boolean(weekResult?.weekScoringFinalized);
    let winner: string | null = null;
    let loser: string | null = null;
    if (a && b && weekResult && weekFinalized) {
      winner = winnerByPointsThenSeed(weekResult.pointsByUserId, a, b, seeds);
      loser = winner === a ? b : a;
    }
    resolved.set(g.id, { spec: g, a, b, weekStart, weekEnd, weekResult, weekFinalized, winner, loser });
  }
  return resolved;
}

export function getScheduledMatchupsForWeek(params: {
  weekStart: string;
  weekStarts: string[];
  memberUserIds: string[];
  seededMemberUserIds?: string[];
  maxTeams: number | null | undefined;
  draftStatus: string | null | undefined;
  weeklyResults: WeeklyMatchupResult[];
}): WeekMatchup[] {
  const {
    weekStart,
    weekStarts,
    memberUserIds,
    seededMemberUserIds,
    maxTeams,
    draftStatus,
    weeklyResults,
  } = params;
  if (!weekStarts.includes(weekStart) || memberUserIds.length < 3) return [];
  if (maxTeams != null && memberUserIds.length !== maxTeams) return [];
  if ((draftStatus ?? "not_started") !== "completed") return [];
  const baseOrder =
    seededMemberUserIds && seededMemberUserIds.length === memberUserIds.length
      ? seededMemberUserIds
      : memberUserIds;

  const idx = weekStarts.indexOf(weekStart);
  if (idx < 0) return [];

  const size = memberUserIds.length;
  const totalWeeks = weekStarts.length;
  const po = leagueSupportsH2HPlayoffs(size) ? playoffRoundsForSize(size) : 0;
  const rsCount = po > 0 ? Math.max(1, totalWeeks - po) : totalWeeks;

  // Regular-season week: rotating round-robin (1v1 first; one rotating triple threat when odd).
  if (po === 0 || idx < rsCount) {
    return getRegularSeasonMatchupsForRound(baseOrder, idx);
  }

  const spec = getPlayoffSpec(size);
  if (!spec) return getRegularSeasonMatchupsForRound(baseOrder, idx);

  const rsWeekStarts = weekStarts.slice(0, rsCount);
  const playoffWeekStarts = weekStarts.slice(rsCount);
  const round = idx - rsCount;

  // Playoffs only begin once the final regular-season week is fully scored (seeds locked).
  const lastRsWeekStart = rsWeekStarts[rsCount - 1]!;
  const lastRsFinalized = Boolean(
    weeklyResults.find((r) => r.weekStart === lastRsWeekStart)?.weekScoringFinalized
  );
  if (!lastRsFinalized) return [];

  const seeds = buildRegularSeasonSeeds(baseOrder, rsWeekStarts, weeklyResults);
  if (seeds.length !== size) return [];

  const resolved = resolvePlayoffGames({ spec, seeds, playoffWeekStarts, weeklyResults });
  const out: WeekMatchup[] = [];
  for (const g of spec.games) {
    if (g.round !== round) continue;
    const rg = resolved.get(g.id);
    if (rg?.a && rg.b) out.push({ type: "h2h", userIds: [rg.a, rg.b] });
  }
  return out;
}

/** True when this league has a Head-to-Head playoff bracket (sizes 4–8, drafted + size-locked). */
export function leagueHasH2HPlayoffSchedule(params: {
  memberCount: number;
  weekCount: number;
  maxTeams: number | null | undefined;
  draftStatus: string | null | undefined;
}): boolean {
  const size = params.memberCount;
  if (!leagueSupportsH2HPlayoffs(size)) return false;
  const po = playoffRoundsForSize(size);
  if (params.weekCount < po + 1) return false;
  if (params.maxTeams != null && params.maxTeams !== size) return false;
  return (params.draftStatus ?? "not_started") === "completed";
}

/**
 * Playoffs are unlocked once the final regular-season week has both passed on the
 * calendar and been fully scored (seeds locked). Regular season = all weeks before
 * the last `playoffRoundsForSize(size)` weeks.
 */
export function playoffsUnlocked(params: {
  weekStarts: string[];
  size: number;
  weeklyResults: WeeklyMatchupResult[];
  todayYmd?: string;
}): boolean {
  const { weekStarts, size, weeklyResults } = params;
  if (!leagueSupportsH2HPlayoffs(size)) return false;
  const po = playoffRoundsForSize(size);
  const totalWeeks = weekStarts.length;
  if (totalWeeks < po + 1) return false;
  const rsCount = Math.max(1, totalWeeks - po);
  const lastRs = weekStarts[rsCount - 1];
  if (!lastRs) return false;
  const todayYmd = params.todayYmd ?? new Date().toISOString().slice(0, 10);
  const calendarPassed = getSundayOfWeek(lastRs) < todayYmd;
  const finalized = Boolean(weeklyResults.find((r) => r.weekStart === lastRs)?.weekScoringFinalized);
  return calendarPassed && finalized;
}

export type PlayoffBracketTeam = {
  userId: string | null;
  seed: number | null;
  points: number | null;
};

export type PlayoffBracketMatch = {
  id: string;
  label: string;
  weekStart: string;
  weekEnd: string;
  teams: [PlayoffBracketTeam, PlayoffBracketTeam];
  winnerUserId: string | null;
  status: "pending" | "active" | "complete";
};

export type PlayoffBracketAutoPlacement = {
  rank: number;
  label: string;
  team: PlayoffBracketTeam;
};

export type PlayoffBracket = {
  size: number;
  rounds: number;
  seeds: Array<{ userId: string; seed: number }>;
  /** Championship-path matches by round (index 0 = first playoff week). */
  championshipRounds: PlayoffBracketMatch[][];
  /** Placement (consolation) matches by round. */
  placementRounds: PlayoffBracketMatch[][];
  /** Teams that earn a final rank with no game (e.g. a lone eliminated team). */
  autoPlacements: PlayoffBracketAutoPlacement[];
  champion: PlayoffBracketTeam | null;
  roundLabels: string[];
};

function playoffRoundStatus(
  weekStart: string,
  weekEnd: string,
  bothTeamsKnown: boolean,
  todayYmd: string,
  weekFinalized: boolean
): PlayoffBracketMatch["status"] {
  if (!bothTeamsKnown) return "pending";
  if (weekFinalized) return "complete";
  if (todayYmd >= weekStart && todayYmd <= weekEnd) return "active";
  if (todayYmd > weekEnd) return "active"; // week calendar ended but PLE/scoring not finalized yet
  return "pending";
}

function bracketTeam(
  userId: string | null,
  seedByUserId: Map<string, number>,
  weekPoints: Record<string, number> | null
): PlayoffBracketTeam {
  if (!userId) return { userId: null, seed: null, points: null };
  return {
    userId,
    seed: seedByUserId.get(userId) ?? null,
    points: weekPoints ? (weekPoints[userId] ?? 0) : null,
  };
}

function toBracketMatch(
  g: ResolvedPlayoffGame,
  seedByUserId: Map<string, number>,
  todayYmd: string
): PlayoffBracketMatch {
  const bothKnown = Boolean(g.a && g.b);
  const status = playoffRoundStatus(g.weekStart, g.weekEnd, bothKnown, todayYmd, g.weekFinalized);
  const weekPoints = g.weekResult?.pointsByUserId ?? null;
  return {
    id: g.spec.id,
    label: g.spec.label,
    weekStart: g.weekStart,
    weekEnd: g.weekEnd,
    teams: [bracketTeam(g.a, seedByUserId, weekPoints), bracketTeam(g.b, seedByUserId, weekPoints)],
    winnerUserId: g.winner,
    status,
  };
}

/**
 * Full Head-to-Head playoff bracket (sizes 4–8) for display once the regular season
 * is complete. Future rounds show TBD until prior-round winners are known.
 */
export function getPlayoffBracket(params: {
  weekStarts: string[];
  memberUserIds: string[];
  seededMemberUserIds?: string[];
  maxTeams: number | null | undefined;
  draftStatus: string | null | undefined;
  weeklyResults: WeeklyMatchupResult[];
  todayYmd?: string;
}): PlayoffBracket | null {
  const { weekStarts, memberUserIds, seededMemberUserIds, maxTeams, draftStatus, weeklyResults } = params;
  const todayYmd = params.todayYmd ?? new Date().toISOString().slice(0, 10);
  const size = memberUserIds.length;
  if (
    !leagueHasH2HPlayoffSchedule({
      memberCount: size,
      weekCount: weekStarts.length,
      maxTeams,
      draftStatus,
    })
  ) {
    return null;
  }
  if (!playoffsUnlocked({ weekStarts, size, weeklyResults, todayYmd })) return null;

  const spec = getPlayoffSpec(size);
  if (!spec) return null;

  const baseOrder =
    seededMemberUserIds && seededMemberUserIds.length === memberUserIds.length
      ? seededMemberUserIds
      : memberUserIds;
  const po = playoffRoundsForSize(size);
  const rsCount = Math.max(1, weekStarts.length - po);
  const seeds = buildRegularSeasonSeeds(baseOrder, weekStarts.slice(0, rsCount), weeklyResults);
  if (seeds.length !== size) return null;

  const seedByUserId = new Map(seeds.map((id, i) => [id, i + 1]));
  const playoffWeekStarts = weekStarts.slice(rsCount);
  const resolved = resolvePlayoffGames({ spec, seeds, playoffWeekStarts, weeklyResults });

  const championshipRounds: PlayoffBracketMatch[][] = [];
  const placementRounds: PlayoffBracketMatch[][] = [];
  for (let r = 0; r < po; r++) {
    const champ: PlayoffBracketMatch[] = [];
    const place: PlayoffBracketMatch[] = [];
    for (const g of spec.games) {
      if (g.round !== r) continue;
      const rg = resolved.get(g.id);
      if (!rg) continue;
      const match = toBracketMatch(rg, seedByUserId, todayYmd);
      if (g.group === "championship") champ.push(match);
      else place.push(match);
    }
    championshipRounds.push(champ);
    placementRounds.push(place);
  }

  const finalGame = resolved.get("final");
  const champion =
    finalGame?.winner != null ? bracketTeam(finalGame.winner, seedByUserId, null) : null;

  const autoPlacements: PlayoffBracketAutoPlacement[] = (spec.autoPlacements ?? []).map((ap) => {
    let userId: string | null = null;
    if (ap.ref.kind === "seed") userId = seeds[ap.ref.seed - 1] ?? null;
    else {
      const g = resolved.get(ap.ref.game);
      userId = g ? (ap.ref.kind === "win" ? g.winner : g.loser) : null;
    }
    return { rank: ap.rank, label: ap.label, team: bracketTeam(userId, seedByUserId, null) };
  });

  return {
    size,
    rounds: po,
    seeds: seeds.map((userId, i) => ({ userId, seed: i + 1 })),
    championshipRounds,
    placementRounds,
    autoPlacements,
    champion,
    roundLabels: playoffRoundLabels(size),
  };
}

/** Label for fantasy week N (1-based) once the schedule enters its playoff rounds. */
export function playoffWeekLabel(weekNumber: number, totalWeeks: number, size: number): string | null {
  if (!leagueSupportsH2HPlayoffs(size)) return null;
  const po = playoffRoundsForSize(size);
  if (totalWeeks < po + 1) return null;
  const rsCount = Math.max(1, totalWeeks - po);
  if (weekNumber <= rsCount) return null;
  const r = weekNumber - rsCount - 1;
  return playoffRoundLabels(size)[r] ?? null;
}

export type MatchupWlt = { w: number; l: number; t: number };

/**
 * Win–loss–tie per manager from weekly H2H / triple-threat pairings, using each week’s event points only
 * (same as matchup scoreboard scores before weekly win/belt bonuses).
 * Counts only finalized weeks (`weekScoringFinalized`: every PWBS event in the Mon–Sun window is `completed`).
 * `season_overall` returns zeros.
 */
export function computeMatchupWltByUserId(
  leagueType: string | null | undefined,
  memberUserIds: string[],
  weeklyResults: WeeklyMatchupResult[],
  opts?: {
    matchupResolver?: (week: WeeklyMatchupResult) => WeekMatchup[];
  }
): Record<string, MatchupWlt> {
  const out: Record<string, MatchupWlt> = {};
  for (const id of memberUserIds) {
    out[id] = { w: 0, l: 0, t: 0 };
  }
  if (leagueType === "season_overall" || leagueType === "salary_cap" || memberUserIds.length < 2) {
    return out;
  }

  const n = memberUserIds.length;
  const today = new Date().toISOString().slice(0, 10);

  for (const week of weeklyResults) {
    const finalized =
      week.weekScoringFinalized ?? week.weekEnd < today;
    if (!finalized) continue;

    const matchups = opts?.matchupResolver ? opts.matchupResolver(week) : getMatchupsForWeek(memberUserIds, n);
    for (const mu of matchups) {
      if (mu.type === "h2h") {
        const [a, b] = mu.userIds;
        const pa = week.pointsByUserId[a] ?? 0;
        const pb = week.pointsByUserId[b] ?? 0;
        if (pa > pb) {
          out[a].w++;
          out[b].l++;
        } else if (pb > pa) {
          out[b].w++;
          out[a].l++;
        } else {
          out[a].t++;
          out[b].t++;
        }
        continue;
      }
      const pts = [mu.userIds[0]!, mu.userIds[1]!, mu.userIds[2]!].map((id) => ({
        id,
        p: week.pointsByUserId[id] ?? 0,
      }));
      pts.sort((a, b) => b.p - a.p);
      const p0 = pts[0]!.p;
      const p1 = pts[1]!.p;
      const p2 = pts[2]!.p;
      const x = pts[0]!.id;
      const y = pts[1]!.id;
      const z = pts[2]!.id;
      if (p0 > p1 && p1 > p2) {
        out[x].w++;
        out[y].l++;
        out[z].l++;
      } else if (p0 > p1 && p1 === p2) {
        out[x].w++;
        out[y].l++;
        out[z].l++;
      } else if (p0 === p1 && p1 > p2) {
        out[x].t++;
        out[y].t++;
        out[z].l++;
      } else {
        out[x].t++;
        out[y].t++;
        out[z].t++;
      }
    }
  }
  return out;
}

/** Week containing today (Monday YYYY-MM-DD) or null if before league start / after end. */
export function getCurrentWeekStart(leagueStart: string, leagueEnd: string): string | null {
  const today = new Date().toISOString().slice(0, 10);
  if (today < leagueStart || today > leagueEnd) return null;
  return getMondayOfWeek(today);
}

/** Standings points = event points + weekly win (+15) and belt (+5 win / +4 retain) bonuses. */
export async function getPointsByOwnerForLeagueWithBonuses(
  leagueId: string,
  supabaseOverride?: SupabaseClient
): Promise<Record<string, number>> {
  const supabase = supabaseOverride ?? (await createClient());
  const { data: league } = await supabase
    .from("leagues")
    .select("league_type")
    .eq("id", leagueId)
    .maybeSingle();
  const leagueType = (league as { league_type?: string | null } | null)?.league_type ?? null;

  const scoring = await getLeagueScoring(leagueId, supabase);
  // Season-overall and pure H2H leagues should use pure event points (no owner matchup bonus points).
  if (
    leagueType === "season_overall" ||
    leagueType === "salary_cap" ||
    !leagueUsesOwnerMatchupBonuses(leagueType)
  ) {
    return scoring.pointsByOwner ?? {};
  }

  const bonuses = await getWeeklyBonusesByOwner(leagueId, supabase);
  const base = scoring.pointsByOwner ?? {};
  const out: Record<string, number> = {};
  const allIds = new Set([...Object.keys(base), ...Object.keys(bonuses)]);
  for (const id of allIds) {
    out[id] = (base[id] ?? 0) + (bonuses[id] ?? 0);
  }
  return out;
}
