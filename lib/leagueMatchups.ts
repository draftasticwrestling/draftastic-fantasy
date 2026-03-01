import { createClient } from "@/lib/supabase/server";
import { getRosterStintsForLeague, getLeagueScoring } from "@/lib/leagues";
import { getPointsForSingleEvent } from "@/lib/scoring/aggregateWrestlerPoints.js";
import { getWeeklyMatchupStructure } from "@/lib/publicLeagueMatchups";
import {
  computeEndOfMonthBeltPointsForSingleMonth,
  inferReignsFromEvents,
  FIRST_END_OF_MONTH_POINTS_DATE,
} from "@/lib/scoring/endOfMonthBeltPoints.js";

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
function getMonthEndInWeek(weekStart: string, weekEnd: string): string | null {
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
  weekStartMonday: string
): Promise<Record<string, number>> {
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

  const { data: events } = await supabase
    .from("events")
    .select("id, name, date, matches")
    .eq("status", "completed")
    .order("date", { ascending: true });

  const allInRange = (events ?? []).filter((e) => {
    const d = (e.date ?? "").toString().slice(0, 10);
    return (!leagueStart || d >= leagueStart) && (!leagueEnd || d <= leagueEnd);
  });
  const stints = await getRosterStintsForLeague(leagueId);
  const pointsByOwner: Record<string, number> = {};
  let kotrCarryOver: Record<string, number> = {};
  for (const event of allInRange) {
    const eventDate = (event.date ?? "").toString().slice(0, 10);
    const inWeek = eventDate >= weekStartMonday && eventDate <= weekEndSunday;
    const { pointsBySlug: eventPoints, updatedCarryOver } = getPointsForSingleEvent(
      event,
      kotrCarryOver
    );
    kotrCarryOver = updatedCarryOver;
    if (!inWeek) continue;
    for (const stint of stints) {
      if (eventDate < stint.acquired_at) continue;
      if (stint.released_at != null && eventDate > stint.released_at) continue;
      const pts = eventPoints[stint.wrestler_id] ?? 0;
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

  const { data: events } = await supabase
    .from("events")
    .select("id, name, date, matches")
    .eq("status", "completed")
    .order("date", { ascending: true });

  const allInRange = (events ?? []).filter((e) => {
    const d = (e.date ?? "").toString().slice(0, 10);
    return (!leagueStart || d >= leagueStart) && (!leagueEnd || d <= leagueEnd);
  });
  const stints = await getRosterStintsForLeague(leagueId);
  const pointsByOwnerByWrestler: Record<string, Record<string, number>> = {};
  let kotrCarryOver: Record<string, number> = {};
  for (const event of allInRange) {
    const eventDate = (event.date ?? "").toString().slice(0, 10);
    const inWeek = eventDate >= weekStartMonday && eventDate <= weekEndSunday;
    const { pointsBySlug: eventPoints, updatedCarryOver } = getPointsForSingleEvent(
      event,
      kotrCarryOver
    );
    kotrCarryOver = updatedCarryOver;
    if (!inWeek) continue;
    for (const stint of stints) {
      if (eventDate < stint.acquired_at) continue;
      if (stint.released_at != null && eventDate > stint.released_at) continue;
      const pts = eventPoints[stint.wrestler_id] ?? 0;
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
 * For combo/head_to_head leagues, end-of-month title (belt) points are included in the week that contains the last day of each month.
 */
export async function getLeagueWeeklyMatchups(
  leagueId: string
): Promise<WeeklyMatchupResult[]> {
  const supabase = await createClient();
  const { data: league } = await supabase
    .from("leagues")
    .select("id, start_date, end_date, draft_date, league_type")
    .eq("id", leagueId)
    .single();
  if (!league) return [];

  const start = (league.draft_date || league.start_date) ?? "";
  const end = league.end_date ?? "";
  if (!start || !end) return [];

  const leagueType = (league as { league_type?: string | null }).league_type ?? null;
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
  let firstEligibleMonthEnd = FIRST_END_OF_MONTH_POINTS_DATE;

  if (includeMonthlyBeltInMatchup) {
    const lastDayOfStartMonth = getLastDayOfMonthContaining(start);
    firstEligibleMonthEnd =
      lastDayOfStartMonth >= FIRST_END_OF_MONTH_POINTS_DATE
        ? lastDayOfStartMonth
        : FIRST_END_OF_MONTH_POINTS_DATE;

    const [{ data: tableReigns }, { data: eventsInRange }] = await Promise.all([
      supabase.from("championship_history").select("*"),
      supabase
        .from("events")
        .select("id, name, date, matches")
        .eq("status", "completed")
        .gte("date", start)
        .lte("date", end)
        .order("date", { ascending: true }),
    ]);
    const inferredReigns = inferReignsFromEvents(eventsInRange ?? []);
    reigns = (inferredReigns.length > 0 ? inferredReigns : (tableReigns ?? [])) as typeof reigns;
  }

  const weeks = getWeeksInRange(start, end);
  const results: WeeklyMatchupResult[] = [];
  let beltHolder: string | null = null;
  const today = new Date().toISOString().slice(0, 10);
  const stints = includeMonthlyBeltInMatchup ? await getRosterStintsForLeague(leagueId) : [];

  for (const weekStart of weeks) {
    const weekEnd = getSundayOfWeek(weekStart);
    let pointsByUserId = await getPointsByOwnerForLeagueForWeek(leagueId, weekStart);

    if (includeMonthlyBeltInMatchup && reigns.length > 0) {
      const monthEndInWeek = getMonthEndInWeek(weekStart, weekEnd);
      if (
        monthEndInWeek &&
        monthEndInWeek >= firstEligibleMonthEnd &&
        monthEndInWeek <= today
      ) {
        const beltBySlug = computeEndOfMonthBeltPointsForSingleMonth(
          reigns,
          monthEndInWeek,
          firstEligibleMonthEnd
        );
        for (const s of stints) {
          if (s.acquired_at > monthEndInWeek) continue;
          if (s.released_at != null && s.released_at <= monthEndInWeek) continue;
          const pts = beltBySlug[s.wrestler_id] ?? 0;
          if (pts > 0) {
            pointsByUserId[s.user_id] =
              (pointsByUserId[s.user_id] ?? 0) + pts;
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
 * Monthly (end-of-month) belt points by wrestler slug for the given week, when the week
 * contains a month-end. Used so the matchup roster can show event + monthly per wrestler.
 * Returns empty object when not a month-end week or league doesn't use monthly belt.
 */
export async function getMonthlyBeltBySlugForWeek(
  leagueId: string,
  weekStartMonday: string
): Promise<Record<string, number>> {
  const weekEndSunday = getSundayOfWeek(weekStartMonday);
  const today = new Date().toISOString().slice(0, 10);
  const monthEndInWeek = getMonthEndInWeek(weekStartMonday, weekEndSunday);
  if (!monthEndInWeek || monthEndInWeek > today) return {};

  const supabase = await createClient();
  const { data: league } = await supabase
    .from("leagues")
    .select("id, start_date, end_date, draft_date, league_type")
    .eq("id", leagueId)
    .single();
  if (!league) return {};

  const leagueType = (league as { league_type?: string | null }).league_type ?? null;
  const include =
    leagueType === "head_to_head" || leagueType === "combo" || leagueType === null;
  if (!include) return {};

  const start = (league.draft_date || league.start_date) ?? "";
  const end = league.end_date ?? "";
  const lastDayOfStartMonth = getLastDayOfMonthContaining(start);
  const firstEligibleMonthEnd =
    lastDayOfStartMonth >= FIRST_END_OF_MONTH_POINTS_DATE
      ? lastDayOfStartMonth
      : FIRST_END_OF_MONTH_POINTS_DATE;
  if (monthEndInWeek < firstEligibleMonthEnd) return {};

  const [{ data: tableReigns }, { data: eventsInRange }] = await Promise.all([
    supabase.from("championship_history").select("*"),
    supabase
      .from("events")
      .select("id, name, date, matches")
      .eq("status", "completed")
      .gte("date", start)
      .lte("date", end)
      .order("date", { ascending: true }),
  ]);
  const inferredReigns = inferReignsFromEvents(eventsInRange ?? []);
  const reigns = (inferredReigns.length > 0 ? inferredReigns : (tableReigns ?? [])) as Array<{
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

  return computeEndOfMonthBeltPointsForSingleMonth(
    reigns,
    monthEndInWeek,
    firstEligibleMonthEnd
  );
}

/** Total bonus points per owner (weekly win +15 and belt +5/+4) for standings. */
export async function getWeeklyBonusesByOwner(
  leagueId: string
): Promise<Record<string, number>> {
  const matchups = await getLeagueWeeklyMatchups(leagueId);
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

/** Week containing today (Monday YYYY-MM-DD) or null if before league start / after end. */
export function getCurrentWeekStart(leagueStart: string, leagueEnd: string): string | null {
  const today = new Date().toISOString().slice(0, 10);
  if (today < leagueStart || today > leagueEnd) return null;
  return getMondayOfWeek(today);
}

/** Standings points = event points + weekly win (+15) and belt (+5 win / +4 retain) bonuses. */
export async function getPointsByOwnerForLeagueWithBonuses(
  leagueId: string
): Promise<Record<string, number>> {
  const [scoring, bonuses] = await Promise.all([
    getLeagueScoring(leagueId),
    getWeeklyBonusesByOwner(leagueId),
  ]);
  const base = scoring.pointsByOwner ?? {};
  const out: Record<string, number> = {};
  const allIds = new Set([...Object.keys(base), ...Object.keys(bonuses)]);
  for (const id of allIds) {
    out[id] = (base[id] ?? 0) + (bonuses[id] ?? 0);
  }
  return out;
}
