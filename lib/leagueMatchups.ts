import { createClient } from "@/lib/supabase/server";
import { getRostersForLeague, getLeagueScoring } from "@/lib/leagues";
import { aggregateWrestlerPoints } from "@/lib/scoring/aggregateWrestlerPoints.js";

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

/** Points per owner for a single week (Monday–Sunday). Event points only; no weekly/belt bonuses. */
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

  const { data: events } = await supabase
    .from("events")
    .select("id, name, date, matches")
    .eq("status", "completed")
    .order("date", { ascending: true });

  const filtered = (events ?? []).filter((e) => {
    const d = (e.date ?? "").toString().slice(0, 10);
    return d >= weekStartMonday && d <= weekEndSunday;
  });

  const pointsBySlug = aggregateWrestlerPoints(filtered) as Record<
    string,
    { rsPoints: number; plePoints: number; beltPoints: number }
  >;
  const rosters = await getRostersForLeague(leagueId);
  const pointsByOwner: Record<string, number> = {};
  for (const [userId, entries] of Object.entries(rosters)) {
    let total = 0;
    for (const e of entries) {
      const p = pointsBySlug[e.wrestler_id] ?? { rsPoints: 0, plePoints: 0, beltPoints: 0 };
      total += p.rsPoints + p.plePoints + p.beltPoints;
    }
    pointsByOwner[userId] = total;
  }
  return pointsByOwner;
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
 */
export async function getLeagueWeeklyMatchups(
  leagueId: string
): Promise<WeeklyMatchupResult[]> {
  const supabase = await createClient();
  const { data: league } = await supabase
    .from("leagues")
    .select("id, start_date, end_date, draft_date")
    .eq("id", leagueId)
    .single();
  if (!league) return [];

  const start = (league.draft_date || league.start_date) ?? "";
  const end = league.end_date ?? "";
  if (!start || !end) return [];

  const weeks = getWeeksInRange(start, end);
  const results: WeeklyMatchupResult[] = [];
  let beltHolder: string | null = null;

  for (const weekStart of weeks) {
    const weekEnd = getSundayOfWeek(weekStart);
    const pointsByUserId = await getPointsByOwnerForLeagueForWeek(leagueId, weekStart);
    const userIds = Object.keys(pointsByUserId);
    const maxPoints = Math.max(0, ...Object.values(pointsByUserId));
    const winners = userIds.filter((id) => pointsByUserId[id] === maxPoints && maxPoints > 0);
    const winnerUserId = winners.length === 1 ? winners[0]! : null;

    let beltHolderUserId: string | null = null;
    let beltRetained = false;
    let beltPoints = 0;
    let weeklyWinPoints = 0;

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
