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

/** True for the Royal Rumble match itself — uses Royal Rumble PLE scoring, not generic battle royal rules. */
export function isRoyalRumbleMatch(match) {
  const matchType = getMatchType(match).toLowerCase();
  const sw = match.specialWinnerType ? String(match.specialWinnerType).toLowerCase() : "";
  return matchType.includes("royal rumble") || sw.includes("royal rumble");
}

/**
 * Handicap / uneven sides (e.g. 2v1): participants often use one "vs" between a team
 * ("A & B") and a solo — so {@link countMatchSides} is 2 even though three individuals
 * compete. Uses the same “additional opponents beyond the first” special victory bonus as other multi-person matches.
 */
export function isHandicapMatch(match) {
  if (!match || typeof match !== "object") return false;
  const rawP = match.participants;
  const participantsBlob =
    typeof rawP === "string"
      ? rawP
      : Array.isArray(rawP)
        ? rawP.map((x) => (typeof x === "string" ? x : String(x))).join(" ")
        : "";
  const blob = [
    String(match.matchType ?? ""),
    String(match.match_type ?? ""),
    String(match.stipulation ?? ""),
    String(match.Stipulation ?? ""),
    getMatchTitle(match),
    participantsBlob,
    String(match.result ?? ""),
  ]
    .join(" ")
    .toLowerCase();
  if (/\bhandicap\b/.test(blob)) return true;
  if (/\b2[\s-]*on[\s-]*1\b/.test(blob)) return true;
  if (/\b2[\s-]*vs[\s-]*1\b/.test(blob)) return true;
  if (/\b3[\s-]*on[\s-]*1\b/.test(blob)) return true;
  if (/\b3[\s-]*vs[\s-]*1\b/.test(blob)) return true;
  return false;
}

function getParticipantSideStrings(match) {
  const raw = match?.participants;
  if (Array.isArray(raw)) {
    return raw.map((s) => String(s ?? "").trim()).filter(Boolean);
  }
  const str = String(raw || "").trim();
  if (!str) return [];
  return str.split(/\s+vs\.?\s+/i).map((s) => s.trim()).filter(Boolean);
}

function isTagPairSideString(sideStr) {
  return /\s+&\s+/.test(sideStr) || /\s+and\s+/i.test(sideStr);
}

/**
 * Multi-team tag (3-way / 4-way tag, or fatal four-way with tag pairs per side).
 * Victory bonus counts defeated sides/teams, not individual wrestlers in the losers list.
 */
export function isMultiTeamTagMatch(match) {
  if (!match || typeof match !== "object") return false;

  const mt = getMatchType(match).toLowerCase();
  const stip = String(
    match.stipulation === "Custom/Other" && match.customStipulation
      ? match.customStipulation
      : match.stipulation ?? match.customStipulation ?? ""
  ).toLowerCase();
  const blob = `${mt} ${stip}`;

  const multiTagLabels = [
    "3-way tag team",
    "4-way tag team",
    "5-team tag team",
    "6-team tag team",
    "6-person tag team",
  ];
  if (multiTagLabels.some((label) => blob.includes(label))) return true;

  const sides = getParticipantSideStrings(match);
  if (sides.length < 3) return false;

  if (blob.includes("tag")) return true;

  if (
    (mt.includes("fatal four") || mt.includes("triple threat") || mt.includes("5-way")) &&
    sides.every((s) => isTagPairSideString(s))
  ) {
    return true;
  }

  return false;
}

/** Championship on the line: Boxscore may use `title`, `title_name`, or camelCase. */
export function getMatchTitle(match) {
  if (!match || typeof match !== "object") return "";
  const t = match.title ?? match.title_name ?? match.titleName;
  const s = t != null ? String(t).trim() : "";
  if (!s || s.toLowerCase() === "none") return "";
  return s;
}

/**
 * True when a championship is on the line. Some feeds omit `title` / `title_name` but set
 * `titleOutcome` (e.g. "Champion Retains"); we still must score title defense / change.
 */
export function isTitleMatch(match) {
  if (getMatchTitle(match) !== "") return true;
  const o = (getTitleOutcome(match) || "").toLowerCase().trim();
  if (o === "none" || o === "") return false;
  return (
    o === "champion retains" ||
    o === "new champion" ||
    o === "successful defense" ||
    o === "successful defence" ||
    o === "retains" ||
    (o.includes("champion") && o.includes("retain"))
  );
}

export function getTitleOutcome(match) {
  if (!match || typeof match !== "object") return "None";
  const o =
    match.titleOutcome ??
    match.title_outcome ??
    match.TitleOutcome ??
    match.Title_Outcome;
  if (o == null || String(o).trim() === "") return "None";
  return String(o).trim();
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
