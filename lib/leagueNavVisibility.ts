/**
 * Top league nav (desktop): show Matchups only for explicit H2H-style formats.
 * Total Season Points (`season_overall`), legacy/null, and other types hide Matchups.
 */
export function leagueShowsMatchupsInNav(leagueType: string | null | undefined): boolean {
  return leagueType === "head_to_head" || leagueType === "combo";
}
