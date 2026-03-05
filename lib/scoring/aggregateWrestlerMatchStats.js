import { scoreEvent } from "./scoreEvent.js";
import { normalizeWrestlerName, extractMatchParticipants } from "./parsers/participantParser.js";
import { resolvePersonaToCanonical } from "./personaResolution.js";

/**
 * Aggregate match stats per wrestler from events: MW, Win, Loss, NC, DQW, DQL.
 * @param {Array<{ id: string, name: string, date: string, matches?: object[] }>} events
 * @param {string} [dateFrom] - YYYY-MM-DD inclusive
 * @param {string} [dateTo] - YYYY-MM-DD inclusive
 * @returns {Record<string, { mw: number, win: number, loss: number, nc: number, dqw: number, dql: number }>}
 */
export function aggregateWrestlerMatchStats(events, dateFrom, dateTo) {
  const totals = /** @type {Record<string, { mw: number, win: number, loss: number, nc: number, dqw: number, dql: number }>} */ ({});

  function ensure(slug) {
    if (!totals[slug]) totals[slug] = { mw: 0, win: 0, loss: 0, nc: 0, dqw: 0, dql: 0 };
    return totals[slug];
  }

  const sorted = [...(events || [])].sort((a, b) => (a.date || "").localeCompare(b.date || ""));

  for (const event of sorted) {
    const eventDate = event.date ? String(event.date).slice(0, 10) : "";
    if (dateFrom && eventDate < dateFrom) continue;
    if (dateTo && eventDate > dateTo) continue;

    const scored = scoreEvent(event);
    const rawMatches = event.matches || [];

    for (const m of scored.matches || []) {
      if (m.isPromo || !m.wrestlerPoints?.length) continue;
      const rawMatch = rawMatches.find((mm) => mm.order === m.order) || {};
      const method = (rawMatch.method || "").toLowerCase();
      const dq = method.includes("dq") || method.includes("disqualification");
      const nc = method.includes("no contest");

      const matchData = extractMatchParticipants(rawMatch);
      const winnerSlugs = new Set();
      const loserSlugs = new Set();
      for (const w of matchData.winners || []) {
        const name = typeof w === "string" ? w : (w && w.name) || "";
        const rawSlug = normalizeWrestlerName(name);
        if (rawSlug) winnerSlugs.add(resolvePersonaToCanonical(rawSlug, eventDate) ?? rawSlug);
      }
      for (const l of matchData.losers || []) {
        const name = typeof l === "string" ? l : (l && l.name) || "";
        const rawSlug = normalizeWrestlerName(name);
        if (rawSlug) loserSlugs.add(resolvePersonaToCanonical(rawSlug, eventDate) ?? rawSlug);
      }

      for (const wp of m.wrestlerPoints) {
        const participant = wp.wrestler;
        if (!participant) continue;
        const rawSlug = normalizeWrestlerName(participant);
        if (!rawSlug) continue;
        const slug = resolvePersonaToCanonical(rawSlug, eventDate) ?? rawSlug;
        const t = ensure(slug);
        t.mw += 1;
        if (nc) {
          t.nc += 1;
        } else if (dq) {
          if (winnerSlugs.has(slug)) t.dqw += 1;
          else if (loserSlugs.has(slug)) t.dql += 1;
        } else {
          if (winnerSlugs.has(slug)) t.win += 1;
          else if (loserSlugs.has(slug)) t.loss += 1;
        }
      }
    }
  }

  return totals;
}

/**
 * Event info for one unparsed match (wrestler was in the match but winner/loser/NC could not be determined).
 * @typedef {{ eventId: string, eventName: string, eventDate: string }} UnparsedMatchInfo
 */

/**
 * Collect matches per wrestler where the wrestler participated but no outcome was parsed
 * (not win/loss/nc/dqw/dql). Use this to surface "matches needing review" on profile pages.
 * @param {Array<{ id: string, name: string, date: string, matches?: object[] }>} events
 * @param {string} [dateFrom] - YYYY-MM-DD inclusive
 * @param {string} [dateTo] - YYYY-MM-DD inclusive
 * @returns {Record<string, UnparsedMatchInfo[]>}
 */
export function getUnparsedMatchesByWrestler(events, dateFrom, dateTo) {
  const bySlug = /** @type {Record<string, { eventId: string, eventName: string, eventDate: string }[]>} */ ({});

  function add(slug, event) {
    if (!slug) return;
    if (!bySlug[slug]) bySlug[slug] = [];
    const eventDate = event.date ? String(event.date).slice(0, 10) : "";
    bySlug[slug].push({
      eventId: String(event.id ?? ""),
      eventName: String(event.name ?? "Unknown"),
      eventDate,
    });
  }

  const sorted = [...(events || [])].sort((a, b) => (a.date || "").localeCompare(b.date || ""));

  for (const event of sorted) {
    const eventDate = event.date ? String(event.date).slice(0, 10) : "";
    if (dateFrom && eventDate < dateFrom) continue;
    if (dateTo && eventDate > dateTo) continue;

    const scored = scoreEvent(event);
    const rawMatches = event.matches || [];

    for (const m of scored.matches || []) {
      if (m.isPromo || !m.wrestlerPoints?.length) continue;
      const rawMatch = rawMatches.find((mm) => mm.order === m.order) || {};
      const method = (rawMatch.method || "").toLowerCase();
      const dq = method.includes("dq") || method.includes("disqualification");
      const nc = method.includes("no contest");

      const matchData = extractMatchParticipants(rawMatch);
      const winnerSlugs = new Set();
      const loserSlugs = new Set();
      for (const w of matchData.winners || []) {
        const name = typeof w === "string" ? w : (w && w.name) || "";
        const rawSlug = normalizeWrestlerName(name);
        if (rawSlug) winnerSlugs.add(resolvePersonaToCanonical(rawSlug, eventDate) ?? rawSlug);
      }
      for (const l of matchData.losers || []) {
        const name = typeof l === "string" ? l : (l && l.name) || "";
        const rawSlug = normalizeWrestlerName(name);
        if (rawSlug) loserSlugs.add(resolvePersonaToCanonical(rawSlug, eventDate) ?? rawSlug);
      }

      for (const wp of m.wrestlerPoints) {
        const participant = wp.wrestler;
        if (!participant) continue;
        const rawSlug = normalizeWrestlerName(participant);
        if (!rawSlug) continue;
        const slug = resolvePersonaToCanonical(rawSlug, eventDate) ?? rawSlug;
        const hasOutcome = nc || winnerSlugs.has(slug) || loserSlugs.has(slug);
        if (!hasOutcome) add(slug, event);
      }
    }
  }

  return bySlug;
}

/**
 * Get unparsed match list for a wrestler (same keying as getMatchStatsForWrestler).
 * @param {Record<string, UnparsedMatchInfo[]>} unparsedBySlug
 * @param {string} slugKey - wrestler id
 * @param {string} [nameKey] - normalizeWrestlerName(name)
 * @returns {UnparsedMatchInfo[]}
 */
export function getUnparsedMatchesForWrestler(unparsedBySlug, slugKey, nameKey) {
  if (!unparsedBySlug || typeof unparsedBySlug !== "object") return [];
  const fromSlug = unparsedBySlug[slugKey];
  if (Array.isArray(fromSlug) && fromSlug.length > 0) return fromSlug;
  const norm = slugKey ? normalizeWrestlerName(String(slugKey)) : "";
  if (norm && Array.isArray(unparsedBySlug[norm])) return unparsedBySlug[norm];
  if (nameKey && Array.isArray(unparsedBySlug[nameKey])) return unparsedBySlug[nameKey];
  return [];
}

const DEFAULT_STATS = { mw: 0, win: 0, loss: 0, nc: 0, dqw: 0, dql: 0 };

/**
 * Look up match stats for a wrestler (same keying as getPointsForWrestler).
 * @param {Record<string, { mw: number, win: number, loss: number, nc: number, dqw: number, dql: number }>} statsBySlug
 * @param {string} slugKey - wrestler id
 * @param {string} nameKey - normalizeWrestlerName(name)
 */
export function getMatchStatsForWrestler(statsBySlug, slugKey, nameKey) {
  if (!statsBySlug || typeof statsBySlug !== "object") return DEFAULT_STATS;
  const a = statsBySlug[slugKey];
  if (a && typeof a.mw === "number") return a;
  const norm = slugKey ? normalizeWrestlerName(String(slugKey)) : "";
  if (norm && statsBySlug[norm]) return statsBySlug[norm];
  if (nameKey && statsBySlug[nameKey]) return statsBySlug[nameKey];
  return DEFAULT_STATS;
}
