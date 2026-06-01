import { classifyEventType } from "./parsers/eventClassifier.js";
import { calculateMatchPoints } from "./calculators/pointsCalculator.js";
import { extractMatchParticipants } from "./parsers/participantParser.js";
import { applyMatchCorrections } from "./matchCorrections.js";
import { normalizeWrestlerName } from "./parsers/participantParser.js";
import { getMatchTitle } from "./extractors/matches.js";
import { scoreMainRosterCallUpPromo } from "./mainRosterCallUp.js";

function dedupeParticipantsForScoring(participants) {
  const seen = new Set();
  const out = [];
  for (const p of participants || []) {
    const name = typeof p === "string" ? p : String(p ?? "");
    const key = normalizeWrestlerName(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

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
  const eventStatusNorm = String(event.status ?? "")
    .toLowerCase()
    .trim();
  const eventIsCompleted = eventStatusNorm === "completed";
  const eventIsLive = eventStatusNorm === "live";
  /** Show projected fantasy points on upcoming / scheduled cards (not yet live or final). */
  const projectUpcomingMatchPoints = !eventIsCompleted && !eventIsLive;

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
      const callUpPoints = scoreMainRosterCallUpPromo(match);
      result.matches.push({
        order: match.order,
        participants: match.participants,
        result: match.result,
        method: match.method,
        title: match.title,
        titleOutcome: match.titleOutcome,
        promoOutcome: match.promoOutcome ?? match.promo_outcome,
        isPromo: true,
        wrestlerPoints: callUpPoints,
        winners: [],
        losers: [],
      });
      continue;
    }

    // Live events: only score matches PWBS marked completed (skip upcoming / in-ring).
    // Legacy completed events often omit match.status — treat missing as scorable.
    const rowStatus =
      match.status != null && String(match.status).trim() !== ""
        ? String(match.status).trim().toLowerCase()
        : "";
    const mergedTitle = getMatchTitle(match);
    const matchForScoring = mergedTitle ? { ...match, title: mergedTitle } : match;
    const matchData = extractMatchParticipants(matchForScoring);

    const eventIsLiveNow = String(event.status ?? "").toLowerCase().trim() === "live";
    /** While the card is live, still score in-ring rows so appearance / partial totals show (PWBS marks these non-completed). */
    const matchInProgressWhileEventLive =
      eventIsLiveNow &&
      rowStatus &&
      rowStatus !== "completed" &&
      (rowStatus === "live" ||
        rowStatus === "in progress" ||
        rowStatus === "in_progress" ||
        rowStatus === "in-progress" ||
        rowStatus === "in ring" ||
        rowStatus === "in_ring" ||
        rowStatus === "in-ring");

    if (
      rowStatus &&
      rowStatus !== "completed" &&
      !matchInProgressWhileEventLive &&
      !projectUpcomingMatchPoints
    ) {
      result.matches.push({
        order: match.order,
        participants: match.participants,
        result: match.result,
        method: match.method,
        title: matchForScoring.title,
        titleOutcome: match.titleOutcome ?? match.title_outcome,
        isPromo: false,
        wrestlerPoints: [],
        winners: matchData.winners || [],
        losers: matchData.losers || [],
      });
      continue;
    }

    const wrestlerPoints = [];
    // Only score individual wrestlers; tag team names (e.g. "The Usos") do not earn points
    const toScore = dedupeParticipantsForScoring(
      matchData.participantsForScoring ?? matchData.participants
    );

    for (const participant of toScore) {
      const points = calculateMatchPoints(
        matchForScoring,
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
        kotrPleBonus: points.kotrPleBonus || 0,
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
      title: matchForScoring.title,
      titleOutcome: match.titleOutcome ?? match.title_outcome,
      isPromo: false,
      wrestlerPoints,
      winners: matchData.winners || [],
      losers: matchData.losers || [],
    });
  }

  return result;
}
