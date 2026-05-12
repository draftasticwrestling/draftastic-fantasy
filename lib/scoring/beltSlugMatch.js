import { normalizeWrestlerName } from "./parsers/participantParser.js";
import { resolvePersonaToCanonical } from "./personaResolution.js";

/**
 * @param {Set<string>} set
 * @param {string} raw
 * @param {string} eventDate - YYYY-MM-DD (week-ending Sunday for belt hold, event day for matches)
 */
export function addScoringSlugVariants(set, raw, eventDate) {
  const trimmed = raw.trim();
  if (!trimmed) return;
  set.add(trimmed);
  set.add(trimmed.toLowerCase());
  const norm = normalizeWrestlerName(trimmed);
  if (norm) {
    set.add(norm);
    const resolved = resolvePersonaToCanonical(norm, eventDate) ?? norm;
    set.add(resolved);
  }
  if (trimmed.includes("_")) {
    const hyphenated = trimmed.replace(/_/g, "-");
    const hn = normalizeWrestlerName(hyphenated) || hyphenated.toLowerCase();
    if (hn) {
      set.add(hn);
      const r2 = resolvePersonaToCanonical(hn, eventDate) ?? hn;
      set.add(r2);
    }
  }
}

/**
 * All slug keys that could refer to this wrestler row for a given calendar date (personas, id, display name).
 * @param {string} wrestlerId
 * @param {string} [displayName] - raw or normalized name from wrestlers.name
 * @param {string} eventDate - YYYY-MM-DD
 * @returns {Set<string>}
 */
export function scoringSlugCandidatesForWrestler(wrestlerId, displayName, eventDate) {
  const candidates = new Set();
  addScoringSlugVariants(candidates, String(wrestlerId), eventDate);
  if (displayName) addScoringSlugVariants(candidates, String(displayName), eventDate);
  candidates.add(wrestlerId);
  return candidates;
}

/**
 * Whether belt / event points stored under mapKey should credit this wrestler on eventDate.
 */
export function wrestlerMatchesBeltMapKey(wrestlerId, displayName, mapKey, eventDate) {
  const candidates = scoringSlugCandidatesForWrestler(wrestlerId, displayName, eventDate);
  if (candidates.has(mapKey)) return true;
  const mk = normalizeWrestlerName(String(mapKey));
  if (mk && candidates.has(mk)) return true;
  if (mk) {
    for (const c of candidates) {
      if (normalizeWrestlerName(String(c)) === mk) return true;
    }
  }
  return false;
}
