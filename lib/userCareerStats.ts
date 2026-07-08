import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getPointsByOwnerForLeagueWithBonuses } from "@/lib/leagueMatchups";
import { getAdminClient } from "@/lib/supabase/admin";

export type UserCareerStats = {
  championships: number;
  leaguesJoined: number;
  pointsScored: number;
  tradesCompleted: number;
  freeAgentsSigned: number;
};

const EMPTY_STATS: UserCareerStats = {
  championships: 0,
  leaguesJoined: 0,
  pointsScored: 0,
  tradesCompleted: 0,
  freeAgentsSigned: 0,
};

async function sumFantasyPointsAcrossLeagues(
  userId: string,
  leagueIds: string[]
): Promise<number> {
  const admin = getAdminClient();
  if (!admin || leagueIds.length === 0) return 0;

  let total = 0;
  for (const leagueId of leagueIds) {
    const byOwner = await getPointsByOwnerForLeagueWithBonuses(leagueId, admin);
    total += Number(byOwner[userId] ?? 0);
  }
  return Math.round(total * 10) / 10;
}

/** Aggregate fantasy career counters for the logged-in user's dashboard. */
export async function getUserCareerStats(
  supabase: SupabaseClient,
  userId: string,
  leagueIds: string[]
): Promise<UserCareerStats> {
  if (leagueIds.length === 0) {
    return { ...EMPTY_STATS };
  }

  const [championshipsRes, tradesRes, faRes, pointsScored] = await Promise.all([
    supabase
      .from("user_xp_ledger")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .like("reason", "league_win_%"),
    supabase
      .from("league_trade_proposals")
      .select("id", { count: "exact", head: true })
      .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
      .not("executed_at", "is", null),
    supabase
      .from("league_activity")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("activity_type", "fa_add"),
    sumFantasyPointsAcrossLeagues(userId, leagueIds),
  ]);

  return {
    championships: championshipsRes.count ?? 0,
    leaguesJoined: leagueIds.length,
    pointsScored,
    tradesCompleted: tradesRes.count ?? 0,
    freeAgentsSigned: faRes.count ?? 0,
  };
}
