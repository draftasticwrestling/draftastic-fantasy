import { logger } from "../utils/logger.js";

/**
 * Extract and normalize match data (from Boxscore scraper)
 */

export function isValidMatch(match) {
  if (!match || typeof match !== "object") return false;
  if (!match.participants && !match.result) return false;
  return true;
}

export function getMatchStatus(match) {
  return match.status || "unknown";
}

export function isMatchCompleted(match) {
  return getMatchStatus(match) === "completed";
}

export function getMatchOrder(match) {
  return match.order || 0;
}

/**
 * True if the match is explicitly marked as non-main (e.g. Undercard) by Boxscore.
 */
function isExplicitlyUndercard(match) {
  const cardType = (match.cardType ?? match.card_type ?? "").toString().trim().toLowerCase();
  if (cardType === "undercard") return true;
  if (match.mainEvent === false || match.isMainEvent === false) return true;
  return false;
}

/**
 * True if the match is explicitly marked as main event by Boxscore (cardType "Main Event", mainEvent, etc.).
 */
function isExplicitlyMainEvent(match) {
  const cardType = (match.cardType ?? match.card_type ?? "").toString().trim().toLowerCase();
  if (cardType === "main event") return true;
  if (match.mainEvent === true || match.isMainEvent === true) return true;
  return false;
}

/**
 * True when the match is a main event.
 * Uses Boxscore's explicit main event when present; otherwise order-based logic.
 * When all matches shared the same order (legacy/ambiguous data), only the closing match counts as main event.
 *
 * @param {object} match
 * @param {object[]} allMatches
 * @param {boolean} [singleMainEventOnly] - If true (e.g. Saturday Night's Main Event), only the last match with max order counts. If false/omit (PLEs): any match with max order OR the closing match (last in list) counts, so scheduled main + cash-in both get main event points.
 */
export function isMainEvent(match, allMatches, singleMainEventOnly = false) {
  if (!allMatches || allMatches.length === 0) return false;

  // Boxscore now clearly defines main event: prefer explicit flag when present
  if (isExplicitlyUndercard(match)) return false;
  if (isExplicitlyMainEvent(match)) return true;

  const maxOrder = Math.max(...allMatches.map((m) => getMatchOrder(m)));
  const isClosingMatch = allMatches[allMatches.length - 1] === match;
  const matchesWithMaxOrder = allMatches.filter((m) => getMatchOrder(m) === maxOrder);

  // When every match had the same order (e.g. all 0 or missing), treat only the closing match as main event so we don't score "all main event"
  if (matchesWithMaxOrder.length === allMatches.length) {
    return isClosingMatch;
  }

  if (singleMainEventOnly) {
    let lastMainEventIndex = -1;
    allMatches.forEach((m, i) => {
      if (getMatchOrder(m) === maxOrder) lastMainEventIndex = i;
    });
    return lastMainEventIndex >= 0 && allMatches[lastMainEventIndex] === match;
  }

  return getMatchOrder(match) === maxOrder || isClosingMatch;
}

export function getMatchType(match) {
  return (
    match.matchType ||
    match.match_type ||
    match.stipulation ||
    match.Stipulation ||
    "Unknown"
  );
}

export function isBattleRoyal(match) {
  const matchType = getMatchType(match).toLowerCase();
  const participantsStr =
    typeof match.participants === "string"
      ? match.participants
      : Array.isArray(match.participants)
        ? match.participants.join(" ")
        : "";
  const participants = participantsStr.toLowerCase();
  return (
    matchType.includes("battle royal") ||
    participants.includes("battle royal") ||
    (match.specialWinnerType &&
      match.specialWinnerType.toLowerCase().includes("battle royal"))
  );
}

export function isTitleMatch(match) {
  return match.title && match.title !== "None" && match.title !== "";
}

export function getTitleOutcome(match) {
  return match.titleOutcome || "None";
}

export function isTitleChange(match) {
  const o = (getTitleOutcome(match) || "").toLowerCase().trim();
  return o === "new champion";
}

export function isTitleDefense(match) {
  const o = (getTitleOutcome(match) || "").toLowerCase().trim();
  return (
    o === "champion retains" ||
    o === "successful defense" ||
    o === "successful defence" ||
    o === "retains"
  );
}
