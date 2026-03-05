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
          if (loserSlugs.has(slug)) t.dql += 1;
        } else {
          if (winnerSlugs.has(slug)) t.win += 1;
          if (loserSlugs.has(slug)) t.loss += 1;
        }
      }
    }
  }

  return totals;
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
