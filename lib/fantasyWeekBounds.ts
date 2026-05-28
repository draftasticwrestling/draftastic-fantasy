/**
 * Pure date helpers for fantasy weeks (no server-only deps).
 * Championship Pathway week 1 is Fri–Sun; weeks 2–12 are Mon–Sun.
 */

import {
  getChampionshipPathwayWeekStartsInRange,
  isChampionshipPathwayKickoffFriday,
  resolveChampionshipPathwayWeekBounds,
} from "@/lib/championshipPathwaySchedule";
import { getCivilYmdInPst } from "@/lib/pstCivilTime";

/** Monday of the week containing the given date (YYYY-MM-DD). Weeks are Monday–Sunday. */
export function getMondayOfWeek(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00Z");
  const day = d.getUTCDay();
  const offset = (day + 6) % 7;
  d.setUTCDate(d.getUTCDate() - offset);
  return d.toISOString().slice(0, 10);
}

/** Sunday of the week (weekStart is Monday YYYY-MM-DD). */
export function getSundayOfWeek(weekStart: string): string {
  const d = new Date(weekStart + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + 6);
  return d.toISOString().slice(0, 10);
}

/** End date for a fantasy week (Championship Pathway week 1 is Fri–Sun; others Mon–Sun). */
export function getWeekEndForWeekStart(weekStart: string, leagueStart: string): string {
  const start = leagueStart.slice(0, 10);
  if (isChampionshipPathwayKickoffFriday(start)) {
    const bounds = resolveChampionshipPathwayWeekBounds(weekStart.slice(0, 10), start);
    if (bounds) return bounds.weekEnd;
  }
  return getSundayOfWeek(weekStart);
}

/** List of week-start dates from league start through end (Friday kickoff or Monday). */
export function getWeeksInRange(leagueStart: string, leagueEnd: string): string[] {
  const start = leagueStart.slice(0, 10);
  const end = leagueEnd.slice(0, 10);
  if (isChampionshipPathwayKickoffFriday(start)) {
    return getChampionshipPathwayWeekStartsInRange(start, end);
  }
  const weeks: string[] = [];
  const startMonday = getMondayOfWeek(start);
  let cur = startMonday;
  while (cur <= end) {
    weeks.push(cur);
    const d = new Date(cur + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() + 7);
    cur = d.toISOString().slice(0, 10);
  }
  return weeks;
}

/** Fantasy week key (weekStart) that contains `dateYmd` within the league schedule, if any. */
export function getFantasyWeekStartContainingDate(
  dateYmd: string,
  leagueStart: string,
  leagueEnd: string
): string | null {
  const d = dateYmd.slice(0, 10);
  const weeks = getWeeksInRange(leagueStart, leagueEnd);
  for (const ws of weeks) {
    const we = getWeekEndForWeekStart(ws, leagueStart);
    if (d >= ws && d <= we) return ws;
  }
  return null;
}

/** Default selected week for league leaderboards: in-progress week, else last scheduled week. */
export function getCurrentFantasyWeekStartForLeague(leagueStart: string, leagueEnd: string, now = new Date()): string {
  const start = leagueStart.slice(0, 10);
  const end = leagueEnd.slice(0, 10) || "2099-12-31";
  const todayYmd = getCivilYmdInPst(now.getTime());
  const weeks = getWeeksInRange(start, end);
  if (weeks.length > 0) {
    const inProgress = getFantasyWeekStartContainingDate(todayYmd, start, end);
    if (inProgress) return inProgress;
    if (todayYmd < weeks[0]!) return weeks[0]!;
    return weeks[weeks.length - 1]!;
  }
  return getMondayOfWeek(todayYmd);
}

export function normalizeLeagueLeaderboardWeekStart(
  raw: string | null | undefined,
  leagueStart: string,
  leagueEnd: string,
  now = new Date()
): string {
  const start = leagueStart.slice(0, 10);
  const end = leagueEnd.slice(0, 10) || "2099-12-31";
  const defaultWeek = getCurrentFantasyWeekStartForLeague(start, end, now);
  if (!raw?.trim()) return defaultWeek;

  const m = raw.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(m)) return defaultWeek;

  const weeks = getWeeksInRange(start, end);
  if (weeks.length === 0) {
    const mon = getMondayOfWeek(m);
    const currentMon = getCurrentFantasyWeekStartForLeague(start, end, now);
    return mon > currentMon ? currentMon : mon;
  }

  if (weeks.includes(m)) return m;
  const mon = getMondayOfWeek(m);
  if (weeks.includes(mon)) return mon;

  if (m < weeks[0]!) return weeks[0]!;
  if (m > weeks[weeks.length - 1]!) return weeks[weeks.length - 1]!;
  const prev = weeks.filter((w) => w <= m);
  return prev.length > 0 ? prev[prev.length - 1]! : weeks[0]!;
}

/** Prev/next week keys within the league schedule (next stops at the in-progress week). */
export function leagueLeaderboardWeekNav(
  selectedWeekStart: string,
  leagueStart: string,
  leagueEnd: string,
  now = new Date()
): { weeklyPrevWeekStart: string | null; weeklyNextWeekStart: string | null } {
  const start = leagueStart.slice(0, 10);
  const end = leagueEnd.slice(0, 10) || "2099-12-31";
  const weeks = getWeeksInRange(start, end);
  const currentWeek = getCurrentFantasyWeekStartForLeague(start, end, now);
  const idx = weeks.indexOf(selectedWeekStart);
  if (idx < 0) {
    return { weeklyPrevWeekStart: null, weeklyNextWeekStart: null };
  }
  const weeklyPrevWeekStart = idx > 0 ? weeks[idx - 1]! : null;
  let weeklyNextWeekStart = idx < weeks.length - 1 ? weeks[idx + 1]! : null;
  if (weeklyNextWeekStart && weeklyNextWeekStart > currentWeek) {
    weeklyNextWeekStart = null;
  }
  return { weeklyPrevWeekStart, weeklyNextWeekStart };
}
