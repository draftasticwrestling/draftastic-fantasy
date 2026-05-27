/**
 * Championship Pathway (public salary cap): 12-week seasons that kick off on a Friday SmackDown.
 * Week 1 = kickoff Friday through the following Sunday (includes that weekend's PLE).
 * Weeks 2–12 = Monday–Sunday.
 */

import { getCivilYmdInPst } from "@/lib/pstCivilTime";

export const CHAMPIONSHIP_PATHWAY_SEASON_WEEKS = 12;

/** Beta test kickoff: Friday SmackDown before Clash in Paris weekend. */
export const CHAMPIONSHIP_PATHWAY_BETA_KICKOFF_YMD = "2026-05-29";

export type ChampionshipPathwayWeek = {
  weekNumber: number;
  weekStart: string;
  weekEnd: string;
};

function parseYmd(ymd: string): { y: number; m: number; d: number } {
  const [ys, ms, ds] = ymd.split("-");
  return { y: Number(ys), m: Number(ms), d: Number(ds) };
}

function formatYmd(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function addDaysToYmd(ymd: string, days: number): string {
  const { y, m, d } = parseYmd(ymd);
  const dt = new Date(Date.UTC(y, m - 1, d + days, 12));
  return formatYmd(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

function utcWeekday(ymd: string): number {
  const { y, m, d } = parseYmd(ymd);
  return new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay();
}

/** True when the league start date is a Friday (Championship Pathway kickoff). */
export function isChampionshipPathwayKickoffFriday(ymd: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return false;
  return utcWeekday(ymd) === 5;
}

/**
 * Next Friday on or after `from` (Pacific calendar).
 * If `from` is already Friday in PT, returns that date.
 */
export function nextFridayPacificYmd(from: Date = new Date()): string {
  const todayYmd = getCivilYmdInPst(from.getTime());
  const weekday = utcWeekday(todayYmd);
  const daysUntilFriday = weekday === 5 ? 0 : weekday === 6 ? 6 : (5 - weekday + 7) % 7;
  return addDaysToYmd(todayYmd, daysUntilFriday);
}

/** Sunday ending Championship Pathway week 1 (kickoff Friday + 2 days). */
export function championshipPathwayWeek1End(kickoffFriday: string): string {
  return addDaysToYmd(kickoffFriday, 2);
}

/** Monday starting Championship Pathway week 2 (day after week 1 Sunday). */
export function championshipPathwayWeek2Monday(kickoffFriday: string): string {
  return addDaysToYmd(kickoffFriday, 3);
}

/**
 * Twelve-week window: Friday kickoff through Sunday of week 12.
 * Week 1 is Fri–Sun; weeks 2–12 are Mon–Sun.
 */
export function computeChampionshipPathwaySeasonWindow(from: Date = new Date()): {
  start_date: string;
  end_date: string;
} {
  const start_date = nextFridayPacificYmd(from);
  const week2Monday = championshipPathwayWeek2Monday(start_date);
  const end_date = addDaysToYmd(week2Monday, (CHAMPIONSHIP_PATHWAY_SEASON_WEEKS - 1) * 7 - 1);
  return { start_date, end_date };
}

/** All fantasy weeks between kickoff Friday and league end (inclusive). */
export function getChampionshipPathwayWeeksInRange(
  kickoffFriday: string,
  leagueEnd: string
): ChampionshipPathwayWeek[] {
  if (!isChampionshipPathwayKickoffFriday(kickoffFriday)) return [];

  const weeks: ChampionshipPathwayWeek[] = [
    {
      weekNumber: 1,
      weekStart: kickoffFriday,
      weekEnd: championshipPathwayWeek1End(kickoffFriday),
    },
  ];

  let weekStart = championshipPathwayWeek2Monday(kickoffFriday);
  let weekNumber = 2;
  while (weekStart <= leagueEnd && weekNumber <= CHAMPIONSHIP_PATHWAY_SEASON_WEEKS) {
    const weekEnd = addDaysToYmd(weekStart, 6);
    weeks.push({
      weekNumber,
      weekStart,
      weekEnd: weekEnd > leagueEnd ? leagueEnd : weekEnd,
    });
    weekStart = addDaysToYmd(weekStart, 7);
    weekNumber++;
  }

  return weeks;
}

/** Week keys (weekStart) for leaderboard / matchup iteration. */
export function getChampionshipPathwayWeekStartsInRange(
  kickoffFriday: string,
  leagueEnd: string
): string[] {
  return getChampionshipPathwayWeeksInRange(kickoffFriday, leagueEnd).map((w) => w.weekStart);
}

/** Resolve Mon–Sun or Fri–Sun bounds for a fantasy week key. */
export function resolveChampionshipPathwayWeekBounds(
  weekKey: string,
  kickoffFriday: string
): { weekStart: string; weekEnd: string } | null {
  const weeks = getChampionshipPathwayWeeksInRange(kickoffFriday, "2099-12-31");
  const match = weeks.find((w) => w.weekStart === weekKey);
  return match ? { weekStart: match.weekStart, weekEnd: match.weekEnd } : null;
}

/** Fantasy week number for an event date, or null if outside the pathway window. */
export function championshipPathwayWeekNumberForDate(
  eventDate: string,
  kickoffFriday: string,
  leagueEnd: string
): number | null {
  const d = eventDate.slice(0, 10);
  for (const w of getChampionshipPathwayWeeksInRange(kickoffFriday, leagueEnd)) {
    if (d >= w.weekStart && d <= w.weekEnd) return w.weekNumber;
  }
  return null;
}
