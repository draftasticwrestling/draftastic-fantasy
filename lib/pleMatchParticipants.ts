import {
  extractMatchParticipants,
  normalizeWrestlerName,
} from "@/lib/scoring/parsers/participantParser.js";

/**
 * Wrestler slugs for roster matching on PLE projection pages.
 * Uses the same participant parser as live scoring (tag teams, arrays, & groups, etc.).
 */
export function participantSlugsFromMatch(raw: Record<string, unknown>): string[] {
  try {
    const md = extractMatchParticipants(raw as never);
    const seen = new Set<string>();
    const out: string[] = [];
    for (const p of md.participantsForScoring ?? []) {
      const slug = normalizeWrestlerName(String(p));
      if (!slug || seen.has(slug)) continue;
      seen.add(slug);
      out.push(slug);
    }
    return out;
  } catch {
    return [];
  }
}
