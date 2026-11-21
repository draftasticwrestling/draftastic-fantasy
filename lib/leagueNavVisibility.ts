import { leagueUsesHeadToHeadRecords } from "@/lib/leagueStructure";

/**
 * Top league nav (desktop): show Matchups only for explicit H2H-style formats.
 * Total Season Points (`season_overall`), legacy salary cap, and other types hide Matchups.
 */
export function leagueShowsMatchupsInNav(leagueType: string | null | undefined): boolean {
  return leagueType === "combo" || leagueUsesHeadToHeadRecords(leagueType);
}
