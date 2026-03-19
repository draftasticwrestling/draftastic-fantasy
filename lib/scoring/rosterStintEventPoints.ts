import { normalizeWrestlerName } from "./parsers/participantParser.js";
import { resolvePersonaToCanonical } from "./personaResolution.js";

/**
 * All scoring slugs that could refer to this roster row on a given event date
 * (same logic as aggregate: normalize participant → resolve persona → canonical key).
 */
function scoringSlugCandidatesForRoster(
  wrestlerId: string,
  displayName: string | undefined,
  eventDate: string
): Set<string> {
  const candidates = new Set<string>();
  for (const src of [wrestlerId, displayName].filter(Boolean) as string[]) {
    const norm = normalizeWrestlerName(String(src));
    if (!norm) continue;
    const resolved = resolvePersonaToCanonical(norm, eventDate) ?? norm;
    candidates.add(resolved);
    candidates.add(norm);
  }
  candidates.add(wrestlerId);
  return candidates;
}

/** Whether a roster stint should receive points stored under contribSlug for this event date. */
export function rosterStintMatchesContribSlug(
  wrestlerId: string,
  displayName: string | undefined,
  contribSlug: string,
  eventDate: string
): boolean {
  return scoringSlugCandidatesForRoster(wrestlerId, displayName, eventDate).has(contribSlug);
}

/**
 * Points from a single event's pointsBySlug map for one roster row (handles personas / display names).
 */
export function eventPointsForRosterStint(
  eventPoints: Record<string, number>,
  wrestlerId: string,
  displayName: string | undefined,
  eventDate: string
): number {
  for (const k of scoringSlugCandidatesForRoster(wrestlerId, displayName, eventDate)) {
    const v = eventPoints[k];
    if (v != null && v > 0) return v;
  }
  return 0;
}
