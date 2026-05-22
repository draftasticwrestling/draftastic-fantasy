import { normalizeWrestlerName } from "./parsers/participantParser.js";

/** Promo outcome stored from boxscore admin when an NXT wrestler is called to Raw/SmackDown. */
export const MAIN_ROSTER_CALL_UP_PROMO_OUTCOME = "Main Roster Call Up";

/** One-time bonus credited on the announcement event date. */
export const MAIN_ROSTER_CALL_UP_POINTS = 15;

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

export function isMainRosterCallUpPromo(match) {
  const raw = match?.promoOutcome ?? match?.promo_outcome ?? "";
  return String(raw).trim() === MAIN_ROSTER_CALL_UP_PROMO_OUTCOME;
}

/**
 * Score promo participants when outcome is Main Roster Call Up.
 * @returns {Array<{ wrestler: string, total: number, callUpPoints: number, breakdown: string[] }>}
 */
export function scoreMainRosterCallUpPromo(match) {
  if (!isMainRosterCallUpPromo(match)) return [];

  const participants = dedupeParticipantsForScoring(match?.participants);
  if (participants.length === 0) return [];

  const breakdown = [`Main roster call-up: +${MAIN_ROSTER_CALL_UP_POINTS}`];
  return participants.map((participant) => ({
    wrestler: participant,
    total: MAIN_ROSTER_CALL_UP_POINTS,
    callUpPoints: MAIN_ROSTER_CALL_UP_POINTS,
    matchPoints: 0,
    titlePoints: 0,
    specialPoints: 0,
    mainEventPoints: 0,
    battleRoyalPoints: 0,
    breakdown,
  }));
}
