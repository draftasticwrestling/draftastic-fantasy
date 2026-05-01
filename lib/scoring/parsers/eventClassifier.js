import { logger } from "../utils/logger.js";

/**
 * Event classification for determining scoring rules (from Boxscore scraper)
 */

export const EVENT_TYPES = {
  RAW: "raw",
  SMACKDOWN: "smackdown",
  NXT: "nxt",
  NXT_BATTLEGROUND: "nxt-battleground",
  NXT_DEADLINE: "nxt-deadline",
  NXT_GOLD_RUSH: "nxt-gold-rush",
  NXT_GREAT_AMERICAN_BASH: "nxt-great-american-bash",
  NXT_HALLOWEEN_HAVOC: "nxt-halloween-havoc",
  NXT_HEATWAVE: "nxt-heatwave",
  NXT_HOMECOMING: "nxt-homecoming",
  NXT_NEW_YEARS_EVIL: "nxt-new-years-evil",
  NXT_NO_MERCY: "nxt-no-mercy",
  NXT_REVENGE: "nxt-revenge",
  NXT_ROADBLOCK: "nxt-roadblock",
  NXT_SHOWDOWN: "nxt-showdown",
  NXT_STAND_AND_DELIVER: "nxt-stand-and-deliver",
  NXT_VENGEANCE_DAY: "nxt-vengeance-day",
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
  if (name.includes("crown jewel")) return EVENT_TYPES.CROWN_JEWEL;
  if (name.includes("night of champions"))
    return EVENT_TYPES.NIGHT_OF_CHAMPIONS;
  if (
    name.includes("king of the ring") ||
    name.includes("queen of the ring") ||
    name.includes("king & queen") ||
    name.includes("king and queen")
  )
    return EVENT_TYPES.KING_QUEEN_OF_THE_RING;
  if (name.includes("money in the bank") || name.includes("mitb"))
    return EVENT_TYPES.MONEY_IN_THE_BANK;
  if (
    name.includes("saturday night's main event") ||
    name.includes("saturday nights main event")
  )
    return EVENT_TYPES.SATURDAY_NIGHTS_MAIN_EVENT;
  if (name.includes("backlash")) return EVENT_TYPES.BACKLASH;
  if (name.includes("evolution")) return EVENT_TYPES.EVOLUTION;
  if (name.includes("clash in italy")) return EVENT_TYPES.CLASH_IN_PARIS;
  if (name.includes("clash in paris") || name.includes("clash"))
    return EVENT_TYPES.CLASH_IN_PARIS;
  if (name.includes("wrestlepalooza")) return EVENT_TYPES.WRESTLEPALOOZA;

  // NXT PLEs / specials
  if (name.includes("nxt battleground")) return EVENT_TYPES.NXT_BATTLEGROUND;
  if (name.includes("nxt deadline")) return EVENT_TYPES.NXT_DEADLINE;
  if (name.includes("nxt gold rush")) return EVENT_TYPES.NXT_GOLD_RUSH;
  if (name.includes("nxt great american bash")) return EVENT_TYPES.NXT_GREAT_AMERICAN_BASH;
  if (name.includes("nxt halloween havoc")) return EVENT_TYPES.NXT_HALLOWEEN_HAVOC;
  if (name.includes("nxt heatwave")) return EVENT_TYPES.NXT_HEATWAVE;
  if (name.includes("nxt homecoming")) return EVENT_TYPES.NXT_HOMECOMING;
  if (name.includes("nxt new years evil") || name.includes("nxt new year's evil"))
    return EVENT_TYPES.NXT_NEW_YEARS_EVIL;
  if (name.includes("nxt no mercy")) return EVENT_TYPES.NXT_NO_MERCY;
  if (name.includes("nxt revenge")) return EVENT_TYPES.NXT_REVENGE;
  if (name.includes("nxt roadblock")) return EVENT_TYPES.NXT_ROADBLOCK;
  if (name.includes("nxt showdown")) return EVENT_TYPES.NXT_SHOWDOWN;
  if (name.includes("nxt stand and deliver")) return EVENT_TYPES.NXT_STAND_AND_DELIVER;
  if (name.includes("nxt vengeance day")) return EVENT_TYPES.NXT_VENGEANCE_DAY;

  // NXT weekly TV show
  if (id.includes("nxt")) return EVENT_TYPES.NXT;
  if (
    name === "nxt" ||
    name.startsWith("nxt ") ||
    name === "wwe nxt" ||
    name.startsWith("wwe nxt ")
  )
    return EVENT_TYPES.NXT;

  logger.warn(`Unknown event type: ${eventName}`);
  return EVENT_TYPES.UNKNOWN;
}

export function getPLECategory(eventType) {
  if (
    eventType === EVENT_TYPES.RAW ||
    eventType === EVENT_TYPES.SMACKDOWN ||
    eventType === EVENT_TYPES.NXT
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
      EVENT_TYPES.NXT_BATTLEGROUND,
      EVENT_TYPES.NXT_DEADLINE,
      EVENT_TYPES.NXT_GOLD_RUSH,
      EVENT_TYPES.NXT_GREAT_AMERICAN_BASH,
      EVENT_TYPES.NXT_HALLOWEEN_HAVOC,
      EVENT_TYPES.NXT_HEATWAVE,
      EVENT_TYPES.NXT_HOMECOMING,
      EVENT_TYPES.NXT_NEW_YEARS_EVIL,
      EVENT_TYPES.NXT_NO_MERCY,
      EVENT_TYPES.NXT_REVENGE,
      EVENT_TYPES.NXT_ROADBLOCK,
      EVENT_TYPES.NXT_SHOWDOWN,
      EVENT_TYPES.NXT_STAND_AND_DELIVER,
      EVENT_TYPES.NXT_VENGEANCE_DAY,
    ].includes(eventType)
  )
    return PLE_CATEGORIES.MINOR;
  return PLE_CATEGORIES.WEEKLY;
}

export function isPLE(eventType) {
  return getPLECategory(eventType) !== PLE_CATEGORIES.WEEKLY;
}

/** NXT weekly TV or any branded NXT special/PLE (`nxt-*`), used for roster-based scoring exclusions. */
export function isNxtBrandEventType(eventType) {
  if (!eventType || typeof eventType !== "string") return false;
  return eventType === EVENT_TYPES.NXT || eventType.startsWith("nxt-");
}
