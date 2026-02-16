import { normalizeWrestlerName } from "./parsers/participantParser.js";

/**
 * Get a set of participant slugs from a match (participants can be string or array from Boxscore).
 */
function getParticipantSlugs(match) {
  const raw = match.participants;
  const slugs = new Set();
  if (Array.isArray(raw)) {
    raw.forEach((p) => {
      const s = typeof p === "string" ? normalizeWrestlerName(p) : "";
      if (s) slugs.add(s);
    });
  } else if (typeof raw === "string") {
    raw.split(/\s+vs\.?\s+/i).forEach((part) => {
      const s = normalizeWrestlerName(part.trim());
      if (s) slugs.add(s);
    });
  }
  return slugs;
}

/**
 * Match corrections for known Boxscore typos (by event id).
 * Each entry: { eventId, matchPredicate(match) => boolean, overrides }
 * Or: { eventId, mainEventOnly: true, overrides } — applies to the match with max order (main event).
 */
const MATCH_CORRECTIONS = [
  {
    eventId: "smackdown-20251017-1761444082617",
    matchPredicate(match) {
      const slugs = getParticipantSlugs(match);
      return slugs.has("cody-rhodes") && slugs.has("drew-mcintyre");
    },
    overrides: {
      result: "Drew McIntyre def. Cody Rhodes",
      method: "DQ",
      winner: "drew-mcintyre",
      titleOutcome: "Champion Retains",
      defendingChampion: "cody-rhodes",
    },
  },
  {
    eventId: "raw-20250714",
    mainEventOnly: true,
    overrides: {
      title: "",
      titleOutcome: "",
      participants: [
        "bron-breakker",
        "penta",
        "la-knight",
        "jey-uso",
        "cm-punk",
      ],
      result: "CM Punk def. Bron Breakker, Penta, LA Knight, Jey Uso",
      winner: "cm-punk",
    },
  },
];

/** True if this correction applies to the given event (exact or prefix match on id). */
function correctionAppliesToEvent(correction, eventId) {
  const id = String(eventId || "");
  const cId = String(correction.eventId || "");
  return id === cId || (cId.length > 0 && id.startsWith(cId));
}

/**
 * Apply any registered match corrections to an event's matches (mutates event.matches).
 * Call before scoring so typo fixes from Boxscore are applied.
 * eventId can be matched exactly or by prefix (e.g. "raw-20250714" matches "raw-20250714-1753144554675").
 *
 * @param {Object} event - Event object with id and matches array
 * @returns {Object} The same event reference (matches may be patched)
 */
export function applyMatchCorrections(event) {
  if (!event || !event.matches || !Array.isArray(event.matches)) return event;
  const corrections = MATCH_CORRECTIONS.filter((c) =>
    correctionAppliesToEvent(c, event.id)
  );
  if (corrections.length === 0) return event;

  const matches = event.matches;
  for (const correction of corrections) {
    const { overrides, mainEventOnly, matchPredicate } = correction;
    if (mainEventOnly) {
      const maxOrder = Math.max(
        0,
        ...matches.map((m) => Number(m.order ?? 0))
      );
      const withMaxOrder = matches.filter(
        (m) => Number(m.order ?? 0) === maxOrder
      );
      const mainEventMatch =
        withMaxOrder.length > 0 ? withMaxOrder[withMaxOrder.length - 1] : null;
      if (mainEventMatch) Object.assign(mainEventMatch, overrides);
      continue;
    }
    for (const match of matches) {
      if (matchPredicate(match)) {
        Object.assign(match, overrides);
        break;
      }
    }
  }
  return event;
}
