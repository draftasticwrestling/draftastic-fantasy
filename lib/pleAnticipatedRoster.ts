import { wrestlerMatchesBeltMapKey } from "@/lib/scoring/beltSlugMatch.js";
import { normalizeWrestlerName } from "@/lib/scoring/parsers/participantParser.js";

export type PleRosterEntry = { wrestler_id: string };

export type PleMatchForRoster = {
  participantSlugs: string[];
  eventDate?: string;
};

function displayNameForRosterEntry(
  entry: PleRosterEntry,
  wrestlerDisplayNames: Record<string, string>
): string {
  return wrestlerDisplayNames[entry.wrestler_id]?.trim() || entry.wrestler_id;
}

/** Roster wrestlers from one team who appear in a single match (deduped, sorted). */
export function rosterWrestlersInMatch(
  rosterEntries: PleRosterEntry[],
  matchSlugs: string[],
  eventDate: string,
  wrestlerDisplayNames: Record<string, string>
): PleRosterEntry[] {
  const normalizedSlugs = matchSlugs.map((s) => normalizeWrestlerName(s)).filter(Boolean);
  return rosterEntries.filter((entry) =>
    normalizedSlugs.some((slug) =>
      wrestlerMatchesBeltMapKey(
        entry.wrestler_id,
        wrestlerDisplayNames[entry.wrestler_id],
        slug,
        eventDate
      )
    )
  );
}

/** Sorted display names for roster wrestlers on the card across all matches for one faction. */
export function pleInvolvedWrestlerNamesByUserId(
  userIds: string[],
  rosterByUser: Record<string, PleRosterEntry[]>,
  matches: PleMatchForRoster[],
  wrestlerDisplayNames: Record<string, string>,
  defaultEventDate = ""
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const userId of userIds) {
    const entries = rosterByUser[userId] ?? [];
    const seen = new Set<string>();
    const names: string[] = [];
    for (const match of matches) {
      const eventDate = match.eventDate ?? defaultEventDate;
      for (const entry of rosterWrestlersInMatch(
        entries,
        match.participantSlugs,
        eventDate,
        wrestlerDisplayNames
      )) {
        if (seen.has(entry.wrestler_id)) continue;
        seen.add(entry.wrestler_id);
        names.push(displayNameForRosterEntry(entry, wrestlerDisplayNames));
      }
    }
    out[userId] = names.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  }
  return out;
}
