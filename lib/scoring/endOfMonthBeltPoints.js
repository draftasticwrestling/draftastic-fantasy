import { normalizeWrestlerName } from "./parsers/participantParser.js";
import { parseWinnersAndLosers } from "./parsers/participantParser.js";
import { isTitleMatch, isTitleChange } from "./extractors/matches.js";

/** First month-end when we award hold points (end of May 2025). No points for earlier months. */
export const FIRST_END_OF_MONTH_POINTS_DATE = "2025-05-31";

/** Title reigns prior to this date do not count. Only month-ends on or after this date are included. */
export const REIGN_EFFECTIVE_START = "2025-05-01";

/**
 * Infer championship reigns from event/match data (title changes). Use when championship_history table is empty.
 * Only considers title changes on or after REIGN_EFFECTIVE_START (May 1, 2025); reigns prior to that do not count.
 * @param {Array<{ date: string, matches?: Array<{ title?: string, titleOutcome?: string, result?: string, participants?: string }> }>} events
 * @returns {Array<{ champion: string, title: string, won_date: string, lost_date: string | null }>}
 */
export function inferReignsFromEvents(events) {
  if (!events?.length) return [];

  const sorted = [...events].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  /** @type {Record<string, { champion: string, title: string, won_date: string }[]>} per-title current reign(s) */
  const currentByTitle = {};
  /** @type {Array<{ champion: string, title: string, won_date: string, lost_date: string | null }>} */
  const reigns = [];

  for (const event of sorted) {
    const eventDate = (event.date || "").slice(0, 10);
    if (!eventDate) continue;
    if (eventDate < REIGN_EFFECTIVE_START) continue;

    const matches = event.matches || [];
    for (const match of matches) {
      if (!isTitleMatch(match) || !isTitleChange(match)) continue;

      const title = (match.title || "").trim();
      if (!title) continue;

      const { winners } = parseWinnersAndLosers(match.result || "", match.participants || "");
      const winnerNames = winners.filter(Boolean);
      if (winnerNames.length === 0) continue;

      if (currentByTitle[title]) {
        for (const prev of currentByTitle[title]) {
          reigns.push({
            champion: prev.champion,
            title: prev.title,
            won_date: prev.won_date,
            lost_date: eventDate,
          });
        }
      }

      currentByTitle[title] = winnerNames.map((champion) => ({
        champion,
        title,
        won_date: eventDate,
      }));
    }
  }

  for (const title of Object.keys(currentByTitle)) {
    for (const r of currentByTitle[title]) {
      reigns.push({
        champion: r.champion,
        title: r.title,
        won_date: r.won_date,
        lost_date: null,
      });
    }
  }

  return reigns;
}

/**
 * Belt points per month for holding a title at end of month (from scoring guide).
 * Men's & Women's: World/Undisputed = 10, Intercontinental = 8, US = 7, Tag Team (per member) = 4.
 * Order matters: more specific patterns first.
 */
const TITLE_POINTS = [
  { pattern: /women'?s?\s+world\s+champion|women'?s?\s+champion/i, points: 10 },
  { pattern: /undisputed\s+wwe|wwe\s+undisputed/i, points: 10 },
  { pattern: /heavyweight|heavy\s+weight|world\s+champion/i, points: 10 },
  { pattern: /intercontinental/i, points: 8 },
  { pattern: /\b(us|u\.s\.)\s+champion|\bus\b/i, points: 7 },
  { pattern: /tag\s+team/i, points: 4 },
];

const DEFAULT_TITLE_POINTS = 5;

/**
 * Get belt points for a title name (end-of-month hold). Returns 10, 8, 7, 4, or default.
 * @param {string} titleName - e.g. "Undisputed WWE Championship", "Raw Tag Team"
 * @returns {number}
 */
export function getBeltPointsForTitle(titleName) {
  if (!titleName || typeof titleName !== "string") return DEFAULT_TITLE_POINTS;
  const t = titleName.trim().toLowerCase();
  for (const { pattern, points } of TITLE_POINTS) {
    if (pattern.test(t)) return points;
  }
  return DEFAULT_TITLE_POINTS;
}

/**
 * Get month-end date (last day of month) for a given date string or Date.
 * @param {string|Date} d
 * @returns {string} YYYY-MM-DD
 */
function getMonthEnd(d) {
  const date = typeof d === "string" ? new Date(d + "T12:00:00") : new Date(d);
  const year = date.getFullYear();
  const month = date.getMonth();
  const lastDay = new Date(year, month + 1, 0);
  return lastDay.toISOString().slice(0, 10);
}

/**
 * List of month-end dates (YYYY-MM-DD) from first eligible through the last completed month.
 * The current month's end is excluded until we've passed it (e.g. Feb 2026 end only counts after midnight March 1, 2026).
 * @param {string} firstMonthEnd - YYYY-MM-DD (e.g. FIRST_END_OF_MONTH_POINTS_DATE)
 * @returns {string[]}
 */
function monthEndsSince(firstMonthEnd) {
  const start = new Date(firstMonthEnd + "T12:00:00");
  const now = new Date();
  const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const cutoff = firstOfThisMonth.toISOString().slice(0, 10);
  const out = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cursor < firstOfThisMonth) {
    const monthEnd = getMonthEnd(cursor);
    if (monthEnd >= firstMonthEnd && monthEnd < cutoff) out.push(monthEnd);
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return out;
}

/**
 * Compute belt points for wrestlers who held a title at the end of each month.
 * Uses championship history (e.g. from Pro Wrestling Boxscore) with one row per reign.
 * Points per title: World/Undisputed/Women's = 10, Intercontinental = 8, US = 7, Tag Team (per member) = 4.
 *
 * Expected reign shape: { champion_slug?, champion_id?, champion?, champion_name?, title?, title_name?, won_date?, start_date?, lost_date?, end_date? }
 * - champion_slug or champion_id: preferred (matches wrestlers.id)
 * - champion or champion_name: display name (normalized to slug via normalizeWrestlerName)
 * - title or title_name: used to look up points (e.g. "Undisputed WWE Championship", "Tag Team")
 * - won_date or start_date, lost_date or end_date: YYYY-MM-DD; lost_date null = still champion
 *
 * @param {Array<{ champion_slug?: string | null, champion_id?: string | null, champion?: string | null, champion_name?: string | null, title?: string | null, title_name?: string | null, won_date?: string | null, start_date?: string | null, lost_date?: string | null, end_date?: string | null }>} reigns
 * @param {string} firstMonthEnd - YYYY-MM-DD; first month-end we award points (e.g. "2025-05-31")
 * @returns {Record<string, number>} Additional belt points per wrestler slug
 */
export function computeEndOfMonthBeltPoints(reigns, firstMonthEnd) {
  const bySlug = /** @type {Record<string, number>} */ ({});

  if (!reigns?.length || !firstMonthEnd) return bySlug;

  const monthEndDates = monthEndsSince(firstMonthEnd);

  for (const reign of reigns) {
    const championName = reign.champion ?? reign.champion_name ?? "";
    const slug =
      reign.champion_slug ??
      reign.champion_id ??
      (championName ? normalizeWrestlerName(championName) : null);
    if (!slug) continue;

    let won = (reign.won_date ?? reign.start_date)?.slice(0, 10);
    const lost = (reign.lost_date ?? reign.end_date) ? String(reign.lost_date ?? reign.end_date).slice(0, 10) : null;
    if (!won) continue;
    if (won < REIGN_EFFECTIVE_START) won = REIGN_EFFECTIVE_START;

    const titleName = reign.title ?? reign.title_name ?? "";
    const points = getBeltPointsForTitle(titleName);

    for (const monthEnd of monthEndDates) {
      if (monthEnd < REIGN_EFFECTIVE_START) continue;
      if (won <= monthEnd && (lost == null || lost > monthEnd)) {
        bySlug[slug] = (bySlug[slug] ?? 0) + points;
      }
    }
  }

  return bySlug;
}

/**
 * Get title reigns for a single wrestler (for profile display): which titles they held and which month-ends.
 * @param {Array<{ champion_slug?: string | null, champion_id?: string | null, champion?: string | null, champion_name?: string | null, title?: string | null, title_name?: string | null, won_date?: string | null, start_date?: string | null, lost_date?: string | null, end_date?: string | null }>} reigns
 * @param {string} firstMonthEnd - YYYY-MM-DD
 * @param {string} wrestlerSlug - wrestlers.id to match
 * @returns {Array<{ title: string, monthEnds: string[] }>}
 */
export function getTitleReignsForWrestler(reigns, firstMonthEnd, wrestlerSlug) {
  if (!reigns?.length || !firstMonthEnd || !wrestlerSlug) return [];

  const monthEndDates = monthEndsSince(firstMonthEnd);
  const out = /** @type {Array<{ title: string, monthEnds: string[] }>} */ ([]);

  for (const reign of reigns) {
    const championName = reign.champion ?? reign.champion_name ?? "";
    const slug =
      reign.champion_slug ??
      reign.champion_id ??
      (championName ? normalizeWrestlerName(championName) : null);
    if (slug !== wrestlerSlug) continue;

    let won = (reign.won_date ?? reign.start_date)?.slice(0, 10);
    const lost = (reign.lost_date ?? reign.end_date) ? String(reign.lost_date ?? reign.end_date).slice(0, 10) : null;
    if (!won) continue;
    if (won < REIGN_EFFECTIVE_START) won = REIGN_EFFECTIVE_START;

    const titleName = (reign.title ?? reign.title_name ?? "").trim() || "Championship";
    const monthEnds = monthEndDates.filter(
      (monthEnd) => monthEnd >= REIGN_EFFECTIVE_START && won <= monthEnd && (lost == null || lost > monthEnd)
    );
    if (monthEnds.length > 0) {
      out.push({ title: titleName, monthEnds });
    }
  }

  return out;
}
