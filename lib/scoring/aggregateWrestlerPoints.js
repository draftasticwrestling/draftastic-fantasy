import { scoreEvent } from "./scoreEvent.js";
import { EVENT_TYPES } from "./parsers/eventClassifier.js";
import { normalizeWrestlerName } from "./parsers/participantParser.js";
import { resolvePersonaToCanonical } from "./personaResolution.js";

/**
 * Aggregate R/S (Raw/SmackDown), PLE, and Belt points per wrestler from scored events.
 * Match-based title points (title win/defense) go ONLY into beltPoints; they are never
 * added to rsPoints or plePoints, so Total = R/S + PLE + Belt with no double-counting.
 *
 * @param {Array<{ id: string, name: string, date: string, matches?: object[] }>} events - Event rows with matches
 * @returns {Record<string, { rsPoints: number, plePoints: number, beltPoints: number }>} Keyed by wrestler slug (id)
 */
export function aggregateWrestlerPoints(events) {
  const totals = /** @type {Record<string, { rsPoints: number, plePoints: number, beltPoints: number }>} */ ({});
  /** KOTR qualifier/semi points from R/S that apply to the next Night of Champions. */
  const kotrCarryOver = /** @type {Record<string, number>} */ ({});

  function ensure(slug) {
    if (!totals[slug]) totals[slug] = { rsPoints: 0, plePoints: 0, beltPoints: 0 };
    return totals[slug];
  }

  const sorted = [...(events || [])].sort((a, b) => (a.date || "").localeCompare(b.date || ""));

  for (const event of sorted) {
    const scored = scoreEvent(event);
    const eventType = scored.eventType;
    const isRS = eventType === EVENT_TYPES.RAW || eventType === EVENT_TYPES.SMACKDOWN;
    const isKOTRPLE =
      eventType === EVENT_TYPES.NIGHT_OF_CHAMPIONS ||
      eventType === EVENT_TYPES.KING_QUEEN_OF_THE_RING;

    for (const m of scored.matches || []) {
      if (m.isPromo || !m.wrestlerPoints) continue;
      const eventDate = event.date ? String(event.date).slice(0, 10) : "";
      for (const wp of m.wrestlerPoints) {
        const participant = wp.wrestler;
        if (!participant) continue;
        const rawSlug = normalizeWrestlerName(participant);
        if (!rawSlug) continue;
        const slug = resolvePersonaToCanonical(rawSlug, eventDate) ?? rawSlug;
        const t = ensure(slug);

        if (isRS) {
          t.rsPoints += (wp.matchPoints || 0) + (wp.mainEventPoints || 0) + (wp.battleRoyalPoints || 0);
          const toward = wp.kotrTowardNOC || 0;
          if (toward > 0) kotrCarryOver[slug] = (kotrCarryOver[slug] || 0) + toward;
        } else {
          const carry = isKOTRPLE ? (kotrCarryOver[slug] || 0) : 0;
          if (isKOTRPLE && carry > 0) kotrCarryOver[slug] = 0;
          t.plePoints +=
            carry +
            (wp.matchPoints || 0) +
            (wp.mainEventPoints || 0) +
            (wp.specialPoints || 0) +
            (wp.battleRoyalPoints || 0);
        }
        t.beltPoints += wp.titlePoints || 0;
      }
    }
  }

  return totals;
}
