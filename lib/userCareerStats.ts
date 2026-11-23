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

/**
 * Aggregate fantasy career counters for the logged-in user's dashboard.
 * Every league the user has joined counts, including archived leagues.
 * Archiving only removes a league from the site-admin list.
 */
export async function getUserCareerStats(
  supabase: SupabaseClient,
  userId: string
): Promise<UserCareerStats> {
  const client = getAdminClient() ?? supabase;
  const { data: memberships } = await client
    .from("league_members")
    .select("league_id")
    .eq("user_id", userId);
  const leagueIds = [
    ...new Set(
      (memberships ?? [])
        .map((row) => (row as { league_id?: string | null }).league_id)
        .filter((id): id is string => Boolean(id))
    ),
  ];

  const [championshipsRes, tradesRes, faRes, pointsScored] = await Promise.all([
    client
      .from("user_xp_ledger")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .like("reason", "league_win_%"),
    client
      .from("league_trade_proposals")
      .select("id", { count: "exact", head: true })
      .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
      .not("executed_at", "is", null),
    client
      .from("league_activity")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("activity_type", "fa_add"),
    leagueIds.length > 0 ? sumFantasyPointsAcrossLeagues(userId, leagueIds) : Promise.resolve(0),
  ]);

  return {
    championships: championshipsRes.count ?? 0,
    leaguesJoined: leagueIds.length,
    pointsScored,
    tradesCompleted: tradesRes.count ?? 0,
    freeAgentsSigned: faRes.count ?? 0,
  };
}
