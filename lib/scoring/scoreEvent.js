import { classifyEventType } from "./parsers/eventClassifier.js";
import { calculateMatchPoints } from "./calculators/pointsCalculator.js";
import { extractMatchParticipants } from "./parsers/participantParser.js";
import { applyMatchCorrections } from "./matchCorrections.js";

/**
 * Run fantasy scoring for one event from Supabase.
 * Applies known match corrections (e.g. Boxscore typos) before scoring.
 *
 * @param {Object} event - Event row from Supabase (id, name, date, matches)
 * @returns {Object} { eventId, eventName, eventType, date, matches: [ { order, wrestlerPoints: [...] } ] }
 */
export function scoreEvent(event) {
  applyMatchCorrections(event);
  const classifiedType = classifyEventType(event.name || "", event.id || "");
  const eventWithType = { ...event, classifiedType };
  const matches = event.matches || [];

  const result = {
    eventId: event.id,
    eventName: event.name,
    eventType: classifiedType,
    date: event.date,
    matches: [],
  };

  for (const match of matches) {
    // Promos/segments: no points awarded
    const isPromo =
      (match.matchType && String(match.matchType).toLowerCase() === "promo") ||
      (match.stipulation && String(match.stipulation).toLowerCase() === "promo");
    if (isPromo) {
      result.matches.push({
        order: match.order,
        participants: match.participants,
        result: match.result,
        method: match.method,
        title: match.title,
        titleOutcome: match.titleOutcome,
        isPromo: true,
        wrestlerPoints: [],
      });
      continue;
    }

    const matchData = extractMatchParticipants(match);
    const wrestlerPoints = [];
    // Only score individual wrestlers; tag team names (e.g. "The Usos") do not earn points
    const toScore = matchData.participantsForScoring ?? matchData.participants;

    for (const participant of toScore) {
      const points = calculateMatchPoints(
        match,
        eventWithType,
        matches,
        participant
      );
      wrestlerPoints.push({
        wrestler: participant,
        total: points.total,
        matchPoints: points.matchPoints,
        titlePoints: points.titlePoints,
        specialPoints: points.specialPoints,
        mainEventPoints: points.mainEventPoints,
        battleRoyalPoints: points.battleRoyalPoints,
        breakdown: points.breakdown,
        kotrTowardNOC: points.kotrTowardNOC || 0,
        kotrBracket: points.kotrBracket || null,
        kotrRound: points.kotrRound || null,
        kotrFinalPoints: points.kotrFinalPoints || 0,
        kotrWinnerPoints: points.kotrWinnerPoints || 0,
      });
    }

    result.matches.push({
      order: match.order,
      participants: match.participants,
      result: match.result,
      method: match.method,
      title: match.title,
      titleOutcome: match.titleOutcome,
      isPromo: false,
      wrestlerPoints,
    });
  }

  return result;
}
