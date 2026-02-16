import { logger } from "../utils/logger.js";

/**
 * Event classification for determining scoring rules (from Boxscore scraper)
 */

export const EVENT_TYPES = {
  RAW: "raw",
  SMACKDOWN: "smackdown",
  WRESTLEMANIA_NIGHT_1: "wrestlemania-night-1",
  WRESTLEMANIA_NIGHT_2: "wrestlemania-night-2",
  SUMMERSLAM_NIGHT_1: "summerslam-night-1",
  SUMMERSLAM_NIGHT_2: "summerslam-night-2",
  SURVIVOR_SERIES: "survivor-series",
  ROYAL_RUMBLE: "royal-rumble",
  ELIMINATION_CHAMBER: "elimination-chamber",
  CROWN_JEWEL: "crown-jewel",
  NIGHT_OF_CHAMPIONS: "night-of-champions",
  KING_QUEEN_OF_THE_RING: "king-queen-of-the-ring",
  MONEY_IN_THE_BANK: "money-in-the-bank",
  SATURDAY_NIGHTS_MAIN_EVENT: "saturday-nights-main-event",
  BACKLASH: "backlash",
  EVOLUTION: "evolution",
  CLASH_IN_PARIS: "clash-in-paris",
  WRESTLEPALOOZA: "wrestlepalooza",
  UNKNOWN: "unknown",
};

export const PLE_CATEGORIES = {
  MAJOR: "major",
  MEDIUM: "medium",
  MINOR: "minor",
  WEEKLY: "weekly",
};

/**
 * @param {string} eventName - Event name from DB
 * @param {string} [eventId] - Event id (e.g. "smackdown-20250620") so we can classify by id when name is missing or ambiguous
 */
export function classifyEventType(eventName, eventId = "") {
  const id = (eventId || "").toLowerCase().trim();
  const name = (eventName || "").toLowerCase().trim();

  if (id.includes("smackdown") || name.includes("smackdown") || name.includes("smack down"))
    return EVENT_TYPES.SMACKDOWN;
  if (id.includes("raw") || (name.includes("raw") && !name.includes("tag team")))
    return EVENT_TYPES.RAW;

  if (name.includes("wrestlemania")) {
    if (name.includes("night 1") || name.includes("night one"))
      return EVENT_TYPES.WRESTLEMANIA_NIGHT_1;
    if (name.includes("night 2") || name.includes("night two"))
      return EVENT_TYPES.WRESTLEMANIA_NIGHT_2;
    return EVENT_TYPES.WRESTLEMANIA_NIGHT_1;
  }

  if (name.includes("summer slam") || name.includes("summerslam")) {
    if (name.includes("night 1") || name.includes("night one"))
      return EVENT_TYPES.SUMMERSLAM_NIGHT_1;
    if (name.includes("night 2") || name.includes("night two"))
      return EVENT_TYPES.SUMMERSLAM_NIGHT_2;
    return EVENT_TYPES.SUMMERSLAM_NIGHT_1;
  }

  if (name.includes("survivor series")) return EVENT_TYPES.SURVIVOR_SERIES;
  if (name.includes("royal rumble") || name.includes("royal riyadh rumble"))
    return EVENT_TYPES.ROYAL_RUMBLE;
  if (name.includes("elimination chamber"))
    return EVENT_TYPES.ELIMINATION_CHAMBER;
  if (name.includes("crown jewel") || name.includes("Crown Jewel"))
    return EVENT_TYPES.CROWN_JEWEL;
  if (name.includes("night of champions"))
    return EVENT_TYPES.NIGHT_OF_CHAMPIONS;
  if (
    name.includes("king of the ring") ||
    name.includes("queen of the ring") ||
    name.includes("king & queen") ||
    name.includes("king and queen")
  )
    return EVENT_TYPES.KING_QUEEN_OF_THE_RING;
  if (name.includes("money in the bank")) return EVENT_TYPES.MONEY_IN_THE_BANK;
  if (
    name.includes("saturday night's main event") ||
    name.includes("saturday nights main event")
  )
    return EVENT_TYPES.SATURDAY_NIGHTS_MAIN_EVENT;
  if (name.includes("backlash")) return EVENT_TYPES.BACKLASH;
  if (name.includes("evolution")) return EVENT_TYPES.EVOLUTION;
  if (name.includes("clash in paris") || name.includes("clash"))
    return EVENT_TYPES.CLASH_IN_PARIS;
  if (name.includes("wrestlepalooza")) return EVENT_TYPES.WRESTLEPALOOZA;

  logger.warn(`Unknown event type: ${eventName}`);
  return EVENT_TYPES.UNKNOWN;
}

export function getPLECategory(eventType) {
  if (
    eventType === EVENT_TYPES.RAW ||
    eventType === EVENT_TYPES.SMACKDOWN
  )
    return PLE_CATEGORIES.WEEKLY;
  if (
    [
      EVENT_TYPES.WRESTLEMANIA_NIGHT_1,
      EVENT_TYPES.WRESTLEMANIA_NIGHT_2,
      EVENT_TYPES.SUMMERSLAM_NIGHT_1,
      EVENT_TYPES.SUMMERSLAM_NIGHT_2,
      EVENT_TYPES.SURVIVOR_SERIES,
      EVENT_TYPES.ROYAL_RUMBLE,
    ].includes(eventType)
  )
    return PLE_CATEGORIES.MAJOR;
  if (
    [
      EVENT_TYPES.ELIMINATION_CHAMBER,
      EVENT_TYPES.CROWN_JEWEL,
      EVENT_TYPES.NIGHT_OF_CHAMPIONS,
      EVENT_TYPES.KING_QUEEN_OF_THE_RING,
      EVENT_TYPES.MONEY_IN_THE_BANK,
    ].includes(eventType)
  )
    return PLE_CATEGORIES.MEDIUM;
  if (
    [
      EVENT_TYPES.SATURDAY_NIGHTS_MAIN_EVENT,
      EVENT_TYPES.BACKLASH,
      EVENT_TYPES.EVOLUTION,
      EVENT_TYPES.CLASH_IN_PARIS,
      EVENT_TYPES.WRESTLEPALOOZA,
    ].includes(eventType)
  )
    return PLE_CATEGORIES.MINOR;
  return PLE_CATEGORIES.WEEKLY;
}

export function isPLE(eventType) {
  return getPLECategory(eventType) !== PLE_CATEGORIES.WEEKLY;
}
