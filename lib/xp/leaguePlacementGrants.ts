import type { SupabaseClient } from "@supabase/supabase-js";
import { applyXpGrant } from "@/lib/xp/applyXpGrant";
import { XP_AMOUNTS } from "@/lib/xp/xpReasons";

export type LeagueTeamCount = 3 | 4 | 5 | 6;

/** Idempotent placement XP; pass a service-role Supabase client (e.g. from scripts). */
export async function applyLeaguePlacementXp(
  admin: SupabaseClient,
  args: {
    userId: string;
    leagueId: string;
    seasonKey: string;
    placement: 1 | 2;
    teamCount: LeagueTeamCount;
  }
): Promise<void> {
  const { userId, leagueId, seasonKey, placement, teamCount } = args;
  const idBase = `league_place:${leagueId}:${seasonKey}:${userId}`;
  if (placement === 2) {
    const key =
      teamCount === 3
        ? "league_second_3"
        : teamCount === 4
          ? "league_second_4"
          : teamCount === 5
            ? "league_second_5"
            : "league_second_6";
    const amt =
      teamCount === 3
        ? XP_AMOUNTS.league_second_3
        : teamCount === 4
          ? XP_AMOUNTS.league_second_4
          : teamCount === 5
            ? XP_AMOUNTS.league_second_5
            : XP_AMOUNTS.league_second_6;
    await applyXpGrant(admin, {
      userId,
      delta: amt,
      reason: key,
      idempotencyKey: `${idBase}:2nd:${teamCount}`,
      metadata: { leagueId, teamCount },
    });
    return;
  }
  const key =
    teamCount === 3 ? "league_win_3" : teamCount === 4 ? "league_win_4" : teamCount === 5 ? "league_win_5" : "league_win_6";
  const amt =
    teamCount === 3
      ? XP_AMOUNTS.league_win_3
      : teamCount === 4
        ? XP_AMOUNTS.league_win_4
        : teamCount === 5
          ? XP_AMOUNTS.league_win_5
          : XP_AMOUNTS.league_win_6;
  await applyXpGrant(admin, {
    userId,
    delta: amt,
    reason: key,
    idempotencyKey: `${idBase}:1st:${teamCount}`,
    metadata: { leagueId, teamCount },
  });
}
