/**
 * Shared helpers for computing win/draw/loss outcomes and last-N matches.
 * Used by WrestlerProfile and MatchCard Statistics view.
 */

import { getSortedMatchesForEvent } from './eventMatchesOrder';

export function extractWrestlerSlugs(participants) {
  const slugs = new Set();
  if (!participants) return slugs;
  if (Array.isArray(participants)) {
    participants.forEach((slug) => {
      if (slug && typeof slug === 'string') slugs.add(slug.trim());
    });
    return slugs;
  }
  if (typeof participants !== 'string') return slugs;
  const sides = participants.split(' vs ');
  sides.forEach((side) => {
    const teamMatch = side.match(/^([^(]+)\s*\(([^)]+)\)$/);
    if (teamMatch) {
      teamMatch[2]
        .split('&')
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((slug) => slugs.add(slug));
    } else {
      side
        .split('&')
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((slug) => slugs.add(slug));
    }
  });
  return slugs;
}

export function parseEventDate(dateStr) {
  if (!dateStr) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return new Date(dateStr);
  const parsed = new Date(dateStr);
  return !isNaN(parsed.getTime()) ? parsed : null;
}

function normalizeText(s) {
  return (s || '').toLowerCase().trim().replace(/\s+/g, ' ');
}

function includesName(text, wrestlerName) {
  if (!text || !wrestlerName) return false;
  const hay = normalizeText(text);
  const needle = normalizeText(wrestlerName);
  return !!needle && hay.includes(needle);
}

function didWrestlerParticipate(match, wrestlerSlug, wrestlerMap) {
  const wrestlerName = wrestlerMap?.[wrestlerSlug]?.name;
  const participantSlugs = extractWrestlerSlugs(match?.participants);
  if (participantSlugs.has(wrestlerSlug)) return true;

  if (wrestlerName) {
    if (typeof match?.participants === 'string' && includesName(match.participants, wrestlerName)) return true;
    if (includesName(match?.result, wrestlerName)) return true;
    if (includesName(match?.winner, wrestlerName)) return true;
  }

  return false;
}

const DRAW_RESULT_PHRASES = [
  'no contest',
  'no winner',
  'draw',
  'double count out',
  'double dq',
  'double disqualification',
  'time limit draw',
  'countout draw',
];
const DRAW_METHODS = ['No Contest', 'Double Count Out', 'Draw'];

export function isDrawResult(result, method) {
  const r = (result || '').toLowerCase().trim();
  if (DRAW_RESULT_PHRASES.some((phrase) => r.includes(phrase))) return true;
  if (method && DRAW_METHODS.includes(method)) return true;
  return false;
}

/**
 * Returns 'W' | 'D' | 'L' for a match from the perspective of the given wrestler slug.
 * Draw (D) is only returned when the match was explicitly No Winner (No Contest, Double Count Out, etc.).
 */
export function getMatchOutcome(match, wrestlerSlug, wrestlerMap) {
  const wrestlerName = wrestlerMap?.[wrestlerSlug]?.name;
  const participantSlugs = extractWrestlerSlugs(match.participants);
  const wasInMatch = didWrestlerParticipate(match, wrestlerSlug, wrestlerMap);

  if (match.winner) {
    if (match.winner === wrestlerSlug) return 'W';
    const winnerSlugs = extractWrestlerSlugs(match.winner);
    if (winnerSlugs.has(wrestlerSlug)) return 'W';
    if (wrestlerName && includesName(match.winner, wrestlerName)) return 'W';
    if (wasInMatch) return 'L';
    return 'D';
  }

  if (isDrawResult(match.result, match.method)) return 'D';

  if (!match.result || !match.result.includes(' def. ')) {
    if (wasInMatch) return 'L';
    return 'D';
  }

  const [winnerSide, loserSide] = match.result.split(' def. ').map((s) => s.trim());
  const winnerSlugs = extractWrestlerSlugs(winnerSide);
  const loserSlugs = new Set();
  loserSide.split(/\s+and\s+|\s*&\s+/).forEach((part) => {
    extractWrestlerSlugs(part.trim()).forEach((s) => loserSlugs.add(s));
  });
  if (loserSlugs.size === 0) extractWrestlerSlugs(loserSide).forEach((s) => loserSlugs.add(s));

  if (
    winnerSlugs.has(wrestlerSlug) ||
    (wrestlerName && includesName(winnerSide, wrestlerName))
  )
    return 'W';
  if (
    loserSlugs.has(wrestlerSlug) ||
    (wrestlerName && includesName(loserSide, wrestlerName))
  )
    return 'L';
  if (wasInMatch) return 'L';
  return 'D';
}

/**
 * All completed, non-promo matches for a wrestler in true chronological order (oldest → newest).
 * Same calendar day: events sorted by id; within an event, matches by `order`.
 */
export function buildChronologicalWrestlerMatchList(events, wrestlerSlug, wrestlerMap) {
  const list = [];
  const sortedEvents = [...(events || [])].sort((a, b) => {
    const da = parseEventDate(a.date);
    const db = parseEventDate(b.date);
    if (!da || !db) return 0;
    if (da.getTime() !== db.getTime()) return da - db;
    return String(a.id ?? '').localeCompare(String(b.id ?? ''));
  });
  for (const event of sortedEvents) {
    if (event.status !== 'completed' && event.status !== 'live') continue;
    const sortedMatches = getSortedMatchesForEvent(event);
    for (let i = 0; i < sortedMatches.length; i++) {
      const match = sortedMatches[i];
      if (match.matchType === 'Promo') continue;
      if (match.status != null && match.status !== 'completed') continue;
      if (!didWrestlerParticipate(match, wrestlerSlug, wrestlerMap)) continue;
      list.push({ event, match, matchIndex: i });
    }
  }
  return list;
}

function findMatchIndexInTimeline(timeline, { eventId, matchIndex, matchOrder }) {
  if (eventId == null) return -1;
  if (matchIndex != null) {
    const byCardIndex = timeline.findIndex(
      (item) => String(item.event.id) === String(eventId) && item.matchIndex === matchIndex
    );
    if (byCardIndex >= 0) return byCardIndex;
  }
  if (matchOrder != null && !Number.isNaN(Number(matchOrder))) {
    const mo = Number(matchOrder);
    return timeline.findIndex(
      (item) => String(item.event.id) === String(eventId) && (item.match.order || 0) === mo
    );
  }
  return -1;
}

/**
 * Get last N matches (excluding promos) that the wrestler participated in, newest first in the returned array.
 * Only includes matches from completed events.
 *
 * @param {object} [options]
 * @param {object} [options.wrestlerMap]
 * @param {{ eventId: string, matchIndex: number, matchOrder?: number }} [options.priorToMatch] — When set (e.g. on a
 *   match card), returns the N matches **immediately before this match** on the timeline — not the globally latest N.
 *   Omit on wrestler profiles for "most recent 5 overall".
 */
export function getLastMatchesForWrestler(events, wrestlerSlug, limit = 5, options = {}) {
  const { wrestlerMap, priorToMatch } = options;
  const list = buildChronologicalWrestlerMatchList(events, wrestlerSlug, wrestlerMap);

  if (priorToMatch && priorToMatch.eventId != null) {
    const idx = findMatchIndexInTimeline(list, priorToMatch);
    if (idx <= 0) return [];
    const start = Math.max(0, idx - limit);
    return list.slice(start, idx).reverse();
  }

  if (list.length === 0) return [];
  const start = Math.max(0, list.length - limit);
  return list.slice(start).reverse();
}

/** Match type substrings that exclude per-participant last-5 stats (too many participants). */
const EXCLUDED_STATS_MATCH_PATTERNS = [
  'Royal Rumble',
  'Battle Royal',
  'Elimination Chamber',
  'Survivor Series',
  'War Games',
  'Gauntlet Match',
];

/** Whether this match type should show the last-5 W/D/L boxes in Statistics. */
export function shouldShowLastFiveStats(match, maxParticipantCount = 10) {
  if (!match) return false;
  const mt = (match.matchType || '').toLowerCase();
  if (EXCLUDED_STATS_MATCH_PATTERNS.some((p) => mt.includes(p.toLowerCase())))
    return false;
  const slugs = extractWrestlerSlugs(match.participants);
  return slugs.size <= maxParticipantCount;
}

/** Calendar year from event date string (YYYY-MM-DD safe). */
export function getYearFromEventDate(dateStr) {
  if (!dateStr) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(dateStr).trim())) {
    return parseInt(String(dateStr).slice(0, 4), 10);
  }
  const d = parseEventDate(dateStr);
  return d && !isNaN(d.getTime()) ? d.getFullYear() : null;
}

/** Only the canonical METHOD_OPTIONS value "DQ" counts (matches saved match forms). */
function isDqMethod(method) {
  return (method || '').trim() === 'DQ';
}

/**
 * Yearly match record for a wrestler (completed events only; excludes promos).
 * Internally tracks non-DQ wins/losses plus DQW/DQL; **winTotal** / **lossTotal** are all wins / all losses.
 * W% / L% match common boxscore style: total wins (or losses) ÷ MW (same as Draftastic-style displays).
 * Draw / no-contest style outcomes are counted as NC.
 */
/**
 * All completed matches for a wrestler in a calendar year (newest events first, then card order).
 * Same filters as getMatchRecordStatsForYear; excludes promos and incomplete matches.
 */
export function getMatchesForWrestlerForYear(events, wrestlerSlug, year, wrestlerMap) {
  const sortedEvents = [...(events || [])].sort((a, b) => {
    const da = parseEventDate(a.date);
    const db = parseEventDate(b.date);
    if (!da || !db) return 0;
    return db - da;
  });
  const results = [];
  for (const event of sortedEvents) {
    if (event.status !== 'completed' && event.status !== 'live') continue;
    if (getYearFromEventDate(event.date) !== year) continue;
    const sortedMatches = getSortedMatchesForEvent(event);
    for (let i = 0; i < sortedMatches.length; i++) {
      const match = sortedMatches[i];
      if (match.matchType === 'Promo') continue;
      if (match.status != null && match.status !== 'completed') continue;
      if (!didWrestlerParticipate(match, wrestlerSlug, wrestlerMap)) continue;
      results.push({ event, match, matchIndex: i });
    }
  }
  return results;
}

export function getMatchRecordStatsForYear(events, wrestlerSlug, year, wrestlerMap) {
  let mw = 0;
  let win = 0;
  let loss = 0;
  let nc = 0;
  let dqWin = 0;
  let dqLoss = 0;

  for (const event of events || []) {
    if (event.status !== 'completed' && event.status !== 'live') continue;
    if (getYearFromEventDate(event.date) !== year) continue;
    const sortedMatches = getSortedMatchesForEvent(event);
    for (const match of sortedMatches) {
      if (match.matchType === 'Promo') continue;
      if (match.status != null && match.status !== 'completed') continue;
      if (!didWrestlerParticipate(match, wrestlerSlug, wrestlerMap)) continue;
      mw++;
      const outcome = getMatchOutcome(match, wrestlerSlug, wrestlerMap);
      const method = (match.method || '').trim();
      if (outcome === 'W') {
        if (isDqMethod(method)) dqWin++;
        else win++;
      } else if (outcome === 'L') {
        if (isDqMethod(method)) dqLoss++;
        else loss++;
      } else {
        nc++;
      }
    }
  }

  const pct = (n) => (mw > 0 ? ((n / mw) * 100).toFixed(1) : '0.0');
  const dqTotal = dqWin + dqLoss;
  const winTotal = win + dqWin;
  const lossTotal = loss + dqLoss;
  return {
    mw,
    /** Wins not via DQ (pinfall, submission, etc.) */
    win,
    /** Losses not via DQ */
    loss,
    nc,
    dqWin,
    dqLoss,
    /** All wins (Win column + DQW breakdown) */
    winTotal,
    /** All losses (Loss column + DQL breakdown) */
    lossTotal,
    /** Total wins ÷ MW */
    winPct: pct(winTotal),
    /** Total losses ÷ MW */
    lossPct: pct(lossTotal),
    /** Matches ending in DQ (win or loss) ÷ MW */
    dqPct: pct(dqTotal),
  };
}
