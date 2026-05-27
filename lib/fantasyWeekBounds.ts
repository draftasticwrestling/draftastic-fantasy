/**
 * Pure date helpers for fantasy weeks (no server-only deps).
 * Championship Pathway week 1 is Fri–Sun; weeks 2–12 are Mon–Sun.
 */

import {
  getChampionshipPathwayWeekStartsInRange,
  isChampionshipPathwayKickoffFriday,
  resolveChampionshipPathwayWeekBounds,
} from "@/lib/championshipPathwaySchedule";

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
