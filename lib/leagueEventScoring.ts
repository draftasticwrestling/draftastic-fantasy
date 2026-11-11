import { leagueScoresWweMainEvent } from "@/lib/leagueStructure";
import { EVENT_TYPES, classifyEventType } from "@/lib/scoring/parsers/eventClassifier.js";

/**
 * League standings, since-start totals, and weekly matchups.
 * Event results pages and wrestler profiles still score every show.
 */
export function eventCountsForLeagueMatchPoints(
  event: { name?: string | null; id?: string | null },
  seasonSlug: string | null | undefined
): boolean {
  if (leagueScoresWweMainEvent(seasonSlug)) return true;
  return classifyEventType(String(event.name ?? ""), String(event.id ?? "")) !== EVENT_TYPES.MAIN_EVENT;
}
