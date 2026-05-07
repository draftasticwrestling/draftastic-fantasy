import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getRosterStintsForLeague, getLeagueScoring, getWrestlerDisplayNamesByIds } from "@/lib/leagues";
import { getPointsForSingleEvent } from "@/lib/scoring/aggregateWrestlerPoints.js";
import { brandByWrestlerSlugFromRows } from "@/lib/wrestlerBrandLookup";
import { eventPointsForRosterStint, sumMonthlyBeltPointsForStint } from "@/lib/scoring/rosterStintEventPoints";
import {
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
  weeklyBeltLockYmdForWeek,
} from "@/lib/beltWeeklyHold";
import { isPastEndOfDayPst } from "@/lib/pstCivilTime";
import { leagueUsesWeeklyPstBeltHold } from "@/lib/leagueStructure";
import { getCurrentChampionsMonthlyBeltBySlug } from "@/lib/scoring/currentChampionsBeltSnapshot";
import {
  isRoadToSummerSlam2026WithSummerslamFinale,
  legacySeasonEndBeltSnapshotYmd,
  RTS_2026_LEAGUE_END_DATE,
  shouldSkipJulyMonthEndBeltForRts2026,
} from "@/lib/beltRts2026JulyDeferral";

const BELT_REIGN_INFERENCE_EVENTS_LIMIT = 10000;
import {
  CHAMPIONSHIP_CHANGES_TABLE_NAME,
  inferReignsFromChampionshipChanges,
} from "@/lib/championshipCurrentFromChanges";
import { EVENT_STATUSES_FOR_SCORING } from "@/lib/eventsScoring";

/** Monday of the week containing the given date (YYYY-MM-DD). Weeks are Monday–Sunday. */
export function getMondayOfWeek(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00Z");
  const day = d.getUTCDay(); // 0 Sun .. 6 Sat
  const offset = (day + 6) % 7; // Mon=0, Sun=6
  d.setUTCDate(d.getUTCDate() - offset);
  return d.toISOString().slice(0, 10);
}

/** Sunday of the week (weekStart is Monday YYYY-MM-DD). */
export function getSundayOfWeek(weekStart: string): string {
  const d = new Date(weekStart + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + 6);
  return d.toISOString().slice(0, 10);
}

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

/** List of week-start (Monday) dates from league start through end. */
export function getWeeksInRange(leagueStart: string, leagueEnd: string): string[] {
  const weeks: string[] = [];
  const startMonday = getMondayOfWeek(leagueStart);
  let cur = startMonday;
  while (cur <= leagueEnd) {
    weeks.push(cur);
    const d = new Date(cur + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() + 7);
    cur = d.toISOString().slice(0, 10);
  }
  return weeks;
}

/** Points per owner for a single week (Monday–Sunday). Uses acquisition/release windows.
 * Only events in the week and in league range count; KOTR carryover uses all league events in order. */
export async function getPointsByOwnerForLeagueForWeek(
  leagueId: string,
  weekStartMonday: string,
  supabaseOverride?: SupabaseClient
): Promise<Record<string, number>> {
  const ROSTER_STINT_DATE_OFFSET_DAYS = -1;
  const weekEndSunday = getSundayOfWeek(weekStartMonday);
  const supabase = supabaseOverride ?? (await createClient());
  const { data: league } = await supabase
    .from("leagues")
    .select("id, start_date, end_date, draft_date")
    .eq("id", leagueId)
    .single();
  if (!league) return {};

  const leagueStart = (league.draft_date || league.start_date) ?? "";
  const leagueEnd = league.end_date ?? "";

  const eventsSelectWithStart = supabase
    .from("events")
    .select("id, name, date, broadcast_start_ts, matches")
    .in("status", [...EVENT_STATUSES_FOR_SCORING])
    .order("date", { ascending: true });
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
        ).data ?? []
      : []);

  const allInRange = (events ?? []).filter((e) => {
    const d = (e.date ?? "").toString().slice(0, 10);
    return (!leagueStart || d >= leagueStart) && (!leagueEnd || d <= leagueEnd);
  });
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
  const pointsByOwner: Record<string, number> = {};
  let kotrCarryOver: Record<string, number> = {};
  for (const event of allInRange) {
    const eventDate = (event.date ?? "").toString().slice(0, 10);
    const eventEndOfDayMs = Date.parse(`${eventDate}T23:59:59.999Z`);
    const eventStartMs = (event as { broadcast_start_ts?: string | null }).broadcast_start_ts
      ? Date.parse(String((event as { broadcast_start_ts?: string | null }).broadcast_start_ts))
      : NaN;
    const useBroadcastStart = Number.isFinite(eventStartMs);
    const eventMs = eventEndOfDayMs;
    const broadcastStartMs = useBroadcastStart ? eventStartMs : undefined;
    const inWeek = eventDate >= weekStartMonday && eventDate <= weekEndSunday;
    const { pointsBySlug: eventPoints, updatedCarryOver } = getPointsForSingleEvent(
      event,
      kotrCarryOver,
      brandBySlugWeek
    );
    kotrCarryOver = updatedCarryOver;
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
      const pts = eventPointsForRosterStint(
        eventPoints,
        stint.wrestler_id,
        wrestlerDisplayNames[stint.wrestler_id],
        eventDate
      );
      pointsByOwner[stint.user_id] = (pointsByOwner[stint.user_id] ?? 0) + pts;
    }
  }
  return pointsByOwner;
}

/** Event points per owner per wrestler for a single week (for roster breakdown in matchup view). */
export async function getPointsByOwnerByWrestlerForWeek(
  leagueId: string,
  weekStartMonday: string
): Promise<Record<string, Record<string, number>>> {
  const ROSTER_STINT_DATE_OFFSET_DAYS = -1;
  const weekEndSunday = getSundayOfWeek(weekStartMonday);
  const supabase = await createClient();
  const { data: league } = await supabase
    .from("leagues")
    .select("id, start_date, end_date, draft_date")
    .eq("id", leagueId)
    .single();
  if (!league) return {};

  const leagueStart = (league.draft_date || league.start_date) ?? "";
  const leagueEnd = league.end_date ?? "";

  const eventsSelectWithStart = supabase
    .from("events")
    .select("id, name, date, broadcast_start_ts, matches")
    .in("status", [...EVENT_STATUSES_FOR_SCORING])
    .order("date", { ascending: true });
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
        ).data ?? []
      : []);

  const allInRange = (events ?? []).filter((e) => {
    const d = (e.date ?? "").toString().slice(0, 10);
    return (!leagueStart || d >= leagueStart) && (!leagueEnd || d <= leagueEnd);
  });
  const stints = await getRosterStintsForLeague(leagueId);
  const wrestlerDisplayNames = await getWrestlerDisplayNamesByIds(stints.map((s) => s.wrestler_id));
  const { data: brandRowsBreakdown } = await supabase.from("wrestlers").select("id, brand");
  const brandBySlugBreakdown = brandByWrestlerSlugFromRows(brandRowsBreakdown ?? []);
  const pointsByOwnerByWrestler: Record<string, Record<string, number>> = {};
  let kotrCarryOver: Record<string, number> = {};
  for (const event of allInRange) {
    const eventDate = (event.date ?? "").toString().slice(0, 10);
    const eventEndOfDayMs = Date.parse(`${eventDate}T23:59:59.999Z`);
    const eventStartMs = (event as { broadcast_start_ts?: string | null }).broadcast_start_ts
      ? Date.parse(String((event as { broadcast_start_ts?: string | null }).broadcast_start_ts))
      : NaN;
    const useBroadcastStart = Number.isFinite(eventStartMs);
    const eventMs = eventEndOfDayMs;
    const broadcastStartMs = useBroadcastStart ? eventStartMs : undefined;
    const inWeek = eventDate >= weekStartMonday && eventDate <= weekEndSunday;
    const { pointsBySlug: eventPoints, updatedCarryOver } = getPointsForSingleEvent(
      event,
      kotrCarryOver,
      brandBySlugBreakdown
    );
    kotrCarryOver = updatedCarryOver;
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
      const pts = eventPointsForRosterStint(
        eventPoints,
        stint.wrestler_id,
        wrestlerDisplayNames[stint.wrestler_id],
        eventDate
      );
      if (pts > 0) {
        if (!pointsByOwnerByWrestler[stint.user_id]) pointsByOwnerByWrestler[stint.user_id] = {};
        pointsByOwnerByWrestler[stint.user_id][stint.wrestler_id] =
          (pointsByOwnerByWrestler[stint.user_id][stint.wrestler_id] ?? 0) + pts;
      }
    }
  }
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
};

const WEEKLY_WIN_BONUS = 15;
const BELT_WIN_POINTS = 5;
const BELT_RETAIN_POINTS = 4;

/**
 * All weekly matchups for a league. Winner = most event points that week (tie = no winner).
 * Draftastic Championship: first week winner gets +5; same holder next week +4 retain; new winner +5.
 * Road to SummerSlam: weekly PST title-hold each Mon–Sun week — lock end of day PT on the week’s last PLE if one
 * airs that week, otherwise end of Sunday after SmackDown (before the next Raw).
 * Other seasons: legacy full-tier points on each calendar month-end that falls in the matchup week.
 */
export async function getLeagueWeeklyMatchups(
  leagueId: string,
  supabaseOverride?: SupabaseClient
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
  const useWeeklyBelt = leagueUsesWeeklyPstBeltHold(seasonSlug);
  const includeMonthlyBeltInMatchup =
    leagueType === "head_to_head" ||
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
  /** Populated when belt reign inference runs; used for weekly lock dates (RTS). */
  let beltEventsForWeeklyLock: Array<{ name: string | null; date: string | null; id: string }> = [];

  if (includeMonthlyBeltInMatchup) {
    if (useWeeklyBelt) {
      firstEligibleWeekEndSunday = firstEligibleWeekEndSundayForLeagueStart(start);
    } else {
      firstEligibleMonthEnd = firstLegacyCalendarMonthEndEligibleForLeagueStart(start);
    }

    const [{ data: tableReigns }, eventsRes, changesRes] = await Promise.all([
      supabase.from("championship_history").select("*"),
      supabase
        .from("events")
        .select("id, name, date, matches, broadcast_start_ts")
        .in("status", [...EVENT_STATUSES_FOR_SCORING])
        .gte("date", BELT_REIGN_INFERENCE_EVENTS_FROM)
        .lte("date", end)
        .order("date", { ascending: true })
        .limit(BELT_REIGN_INFERENCE_EVENTS_LIMIT),
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
        .select("id, name, date, matches")
        .in("status", [...EVENT_STATUSES_FOR_SCORING])
        .gte("date", BELT_REIGN_INFERENCE_EVENTS_FROM)
        .lte("date", end)
        .order("date", { ascending: true })
        .limit(BELT_REIGN_INFERENCE_EVENTS_LIMIT);
      eventsInRange = (ev2 ?? []) as EventRowForReignInference[];
    }
    useBroadcastForMonthlyBelt = (eventsInRange as Array<{ broadcast_start_ts?: string | null }>).some(
      (e) => !!e.broadcast_start_ts
    );
    const changesRows = changesRes.error ? [] : (changesRes.data ?? []);
    const changesReigns = inferReignsFromChampionshipChanges(changesRows);
    const inferredReigns = inferReignsFromEvents(eventsInRange);
    reigns = mergeReigns(tableReigns ?? [], [...inferredReigns, ...changesReigns]) as typeof reigns;
    beltEventsForWeeklyLock = eventsInRange as Array<{ name: string | null; date: string | null; id: string }>;
  }

  const weeks = getWeeksInRange(start, end);
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
  const monthlyBeltNameByWrestler =
    includeMonthlyBeltInMatchup && stints.length > 0
      ? supabaseOverride
        ? Object.fromEntries(
            (
              (
                await supabase
                  .from("wrestlers")
                  .select("id, name")
                  .in("id", [...new Set(stints.map((s) => s.wrestler_id).filter(Boolean))])
              ).data ?? []
            ).map((w) => {
              const row = w as { id: string; name: string | null };
              return [row.id, row.name ?? row.id];
            })
          )
        : await getWrestlerDisplayNamesByIds([...new Set(stints.map((s) => s.wrestler_id))])
      : {};

  for (const weekStart of weeks) {
    const weekEnd = getSundayOfWeek(weekStart);
    let pointsByUserId = await getPointsByOwnerForLeagueForWeek(leagueId, weekStart, supabase);

    if (includeMonthlyBeltInMatchup && reigns.length > 0) {
      if (useWeeklyBelt) {
        const lastBeltWeekEnd = beltScoringLastWeekEndSundayInclusive(end);
        const beltLockYmd = weeklyBeltLockYmdForWeek(weekStart, weekEnd, beltEventsForWeeklyLock);
        const inLeagueBeltWindow =
          weekEnd >= firstEligibleWeekEndSunday &&
          (!lastBeltWeekEnd || weekEnd <= lastBeltWeekEnd) &&
          isPastEndOfDayPst(beltLockYmd);

        if (inLeagueBeltWindow) {
          const beltBySlug = computeWeeklyBeltHoldPointsForWeekEndSunday(
            reigns,
            beltLockYmd,
            firstEligibleWeekEndSunday,
            weekEnd
          );
          for (const s of stints) {
            if (
              !rosterStintActiveForWeeklyBeltHold({
                stint: s,
                weekEndYmd: beltLockYmd,
                useBroadcastStart: useBroadcastForMonthlyBelt,
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
          for (const s of stints) {
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
          for (const s of stints) {
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

    const weekNotOver = today <= weekEnd;

    let winnerUserId: string | null = null;
    let beltHolderUserId: string | null = null;
    let beltRetained = false;
    let beltPoints = 0;
    let weeklyWinPoints = 0;

    if (!weekNotOver) {
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
    });
  }

  return results;
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

  const [{ data: tableReigns }, { data: eventsInRange }, changesRes] = await Promise.all([
    supabase.from("championship_history").select("*"),
    supabase
      .from("events")
      .select("id, name, date, matches")
      .in("status", [...EVENT_STATUSES_FOR_SCORING])
      .gte("date", BELT_REIGN_INFERENCE_EVENTS_FROM)
      .lte("date", end)
      .order("date", { ascending: true })
      .limit(BELT_REIGN_INFERENCE_EVENTS_LIMIT),
    supabase
      .from(CHAMPIONSHIP_CHANGES_TABLE_NAME)
      .select("championship_type, champion, champion_slug, date")
      .order("date", { ascending: true }),
  ]);
  const changesRows = changesRes.error ? [] : (changesRes.data ?? []);
  const changesReigns = inferReignsFromChampionshipChanges(changesRows);
  const inferredReigns = inferReignsFromEvents(eventsInRange ?? []);
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
    const evRows = (eventsInRange ?? []) as Array<{ name: string | null; date: string | null; id: string }>;
    const beltLockYmd = weeklyBeltLockYmdForWeek(weekStartMonday, weekEndSunday, evRows);
    if (
      weekEndSunday < firstEligibleWeekEndSunday ||
      (lastBeltWeekEnd && weekEndSunday > lastBeltWeekEnd) ||
      !isPastEndOfDayPst(beltLockYmd)
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

function getRoundRobinH2HForWeek(memberUserIds: string[], roundIndex: number): WeekMatchup[] {
  if (memberUserIds.length < 4 || memberUserIds.length % 2 !== 0) return [];
  const ids = [...memberUserIds].sort((a, b) => a.localeCompare(b));
  const n = ids.length;
  const rounds = n - 1;
  if (rounds <= 0) return [];
  const r = ((roundIndex % rounds) + rounds) % rounds;
  const arr = [...ids];
  for (let i = 0; i < r; i++) {
    const moved = arr.pop();
    if (!moved) break;
    arr.splice(1, 0, moved);
  }
  const out: WeekMatchup[] = [];
  for (let i = 0; i < n / 2; i++) {
    out.push({ type: "h2h", userIds: [arr[i]!, arr[n - 1 - i]!] });
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

function buildRegularSeasonSeedsForEightTeamLeague(
  memberUserIds: string[],
  regularSeasonWeekStarts: string[],
  weeklyResults: WeeklyMatchupResult[]
): string[] {
  const rounds = regularSeasonWeekStarts.map((_, i) => getRoundRobinH2HForWeek(memberUserIds, i));
  const wlt: Record<string, { w: number; l: number; t: number }> = Object.fromEntries(
    memberUserIds.map((id) => [id, { w: 0, l: 0, t: 0 }])
  );
  const pointsTotal: Record<string, number> = Object.fromEntries(memberUserIds.map((id) => [id, 0]));
  for (let i = 0; i < regularSeasonWeekStarts.length; i++) {
    const weekStart = regularSeasonWeekStarts[i]!;
    const weekResult = weeklyResults.find((r) => r.weekStart === weekStart);
    if (!weekResult) continue;
    for (const id of memberUserIds) pointsTotal[id] = (pointsTotal[id] ?? 0) + (weekResult.pointsByUserId[id] ?? 0);
    for (const mu of rounds[i] ?? []) {
      const [a, b] = mu.userIds;
      const pa = weekResult.pointsByUserId[a] ?? 0;
      const pb = weekResult.pointsByUserId[b] ?? 0;
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
    }
  }
  return [...memberUserIds].sort((a, b) => {
    const wa = wlt[a]!;
    const wb = wlt[b]!;
    if (wb.w !== wa.w) return wb.w - wa.w;
    if (wa.l !== wb.l) return wa.l - wb.l;
    if (wb.t !== wa.t) return wb.t - wa.t;
    if ((pointsTotal[b] ?? 0) !== (pointsTotal[a] ?? 0)) return (pointsTotal[b] ?? 0) - (pointsTotal[a] ?? 0);
    return a.localeCompare(b);
  });
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
  if (memberUserIds.length !== 8 || weekStarts.length < 11) {
    return getMatchupsForWeek(baseOrder, baseOrder.length);
  }

  // Weeks 1-8: seven-round robin, then week 8 repeats week 1 pairings.
  if (idx < 7) return getRoundRobinH2HForWeek(baseOrder, idx);
  if (idx === 7) return getRoundRobinH2HForWeek(baseOrder, 0);

  const week8Start = weekStarts[7]!;
  const week8Ended = getSundayOfWeek(week8Start) < new Date().toISOString().slice(0, 10);
  if (!week8Ended) return [];

  const regularSeasonWeeks = weekStarts.slice(0, 8);
  const seeds = buildRegularSeasonSeedsForEightTeamLeague(baseOrder, regularSeasonWeeks, weeklyResults);
  if (seeds.length !== 8) return [];

  // Week 9: quarterfinals (1v8, 4v5, 2v7, 3v6)
  if (idx === 8) {
    return [
      { type: "h2h", userIds: [seeds[0]!, seeds[7]!] },
      { type: "h2h", userIds: [seeds[3]!, seeds[4]!] },
      { type: "h2h", userIds: [seeds[1]!, seeds[6]!] },
      { type: "h2h", userIds: [seeds[2]!, seeds[5]!] },
    ];
  }

  const week9Start = weekStarts[8]!;
  const week9Ended = getSundayOfWeek(week9Start) < new Date().toISOString().slice(0, 10);
  if (!week9Ended) return [];
  const week9 = weeklyResults.find((r) => r.weekStart === week9Start);
  if (!week9) return [];
  const qf1w = winnerByPointsThenSeed(week9.pointsByUserId, seeds[0]!, seeds[7]!, seeds);
  const qf2w = winnerByPointsThenSeed(week9.pointsByUserId, seeds[3]!, seeds[4]!, seeds);
  const qf3w = winnerByPointsThenSeed(week9.pointsByUserId, seeds[1]!, seeds[6]!, seeds);
  const qf4w = winnerByPointsThenSeed(week9.pointsByUserId, seeds[2]!, seeds[5]!, seeds);
  const qf1l = qf1w === seeds[0] ? seeds[7]! : seeds[0]!;
  const qf2l = qf2w === seeds[3] ? seeds[4]! : seeds[3]!;
  const qf3l = qf3w === seeds[1] ? seeds[6]! : seeds[1]!;
  const qf4l = qf4w === seeds[2] ? seeds[5]! : seeds[2]!;

  // Week 10: semifinals for championship + placement bracket.
  if (idx === 9) {
    return [
      { type: "h2h", userIds: [qf1w, qf2w] },
      { type: "h2h", userIds: [qf3w, qf4w] },
      { type: "h2h", userIds: [qf1l, qf2l] },
      { type: "h2h", userIds: [qf3l, qf4l] },
    ];
  }

  const week10Start = weekStarts[9]!;
  const week10Ended = getSundayOfWeek(week10Start) < new Date().toISOString().slice(0, 10);
  if (!week10Ended) return [];
  const week10 = weeklyResults.find((r) => r.weekStart === week10Start);
  if (!week10) return [];
  const sf1w = winnerByPointsThenSeed(week10.pointsByUserId, qf1w, qf2w, seeds);
  const sf2w = winnerByPointsThenSeed(week10.pointsByUserId, qf3w, qf4w, seeds);
  const sf1l = sf1w === qf1w ? qf2w : qf1w;
  const sf2l = sf2w === qf3w ? qf4w : qf3w;
  const sf3w = winnerByPointsThenSeed(week10.pointsByUserId, qf1l, qf2l, seeds);
  const sf4w = winnerByPointsThenSeed(week10.pointsByUserId, qf3l, qf4l, seeds);
  const sf3l = sf3w === qf1l ? qf2l : qf1l;
  const sf4l = sf4w === qf3l ? qf4l : qf3l;

  // Week 11: finals for 1/2, 3/4, 5/6, 7/8.
  return [
    { type: "h2h", userIds: [sf1w, sf2w] },
    { type: "h2h", userIds: [sf1l, sf2l] },
    { type: "h2h", userIds: [sf3w, sf4w] },
    { type: "h2h", userIds: [sf3l, sf4l] },
  ];
}

export type MatchupWlt = { w: number; l: number; t: number };

/**
 * Win–loss–tie per manager from weekly H2H / triple-threat pairings, using each week’s event points only
 * (same as matchup scoreboard scores before weekly win/belt bonuses).
 * Counts only completed weeks (`weekEnd` &lt; today, UTC YYYY-MM-DD). `season_overall` returns zeros.
 */
export function computeMatchupWltByUserId(
  leagueType: string | null | undefined,
  memberUserIds: string[],
  weeklyResults: WeeklyMatchupResult[],
): Record<string, MatchupWlt> {
  const out: Record<string, MatchupWlt> = {};
  for (const id of memberUserIds) {
    out[id] = { w: 0, l: 0, t: 0 };
  }
  if (leagueType === "season_overall" || memberUserIds.length < 2) {
    return out;
  }

  const n = memberUserIds.length;
  const today = new Date().toISOString().slice(0, 10);

  for (const week of weeklyResults) {
    if (week.weekEnd >= today) continue;

    const matchups = getMatchupsForWeek(memberUserIds, n);
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
  // Season-overall leagues should use pure event points (no weekly matchup bonuses).
  if (leagueType === "season_overall") {
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
