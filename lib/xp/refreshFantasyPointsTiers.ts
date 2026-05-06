import "server-only";

import { getAdminClient } from "@/lib/supabase/admin";
import { getPointsByOwnerForLeagueWithBonuses } from "@/lib/leagueMatchups";
import { awardUserXp } from "@/lib/xp/awardUserXp";
import { XP_AMOUNTS } from "@/lib/xp/xpReasons";

/**
 * Sums this user's fantasy points across non-archived leagues in the current season and awards
 * +10 XP for each new block of 50 points since the last check (stored in user_xp_state.fantasy_points_tiers_claimed).
 */
export async function refreshFantasyPointsTiersForUser(userId: string): Promise<void> {
  const admin = getAdminClient();
  if (!admin) return;

  const { data: memberships } = await admin
    .from("league_members")
    .select("league_id, leagues!inner(id, is_archived)")
    .eq("user_id", userId);
  const rows = (memberships ?? []) as { league_id: string; leagues?: { is_archived?: boolean | null } | null }[];
  const leagueIds = [
    ...new Set(
      rows.filter((r) => !(r.leagues?.is_archived ?? false)).map((r) => r.league_id)
    ),
  ];

  let sumPoints = 0;
  for (const leagueId of leagueIds) {
    const byOwner = await getPointsByOwnerForLeagueWithBonuses(leagueId);
    sumPoints += byOwner[userId] ?? 0;
  }

  const tiersNow = Math.floor(sumPoints / 50);
  const { data: state } = await admin
    .from("user_xp_state")
    .select("fantasy_points_tiers_claimed, total_xp, login_streak, last_daily_login")
    .eq("user_id", userId)
    .maybeSingle();
  const claimed =
    (state as { fantasy_points_tiers_claimed?: number } | null)?.fantasy_points_tiers_claimed ?? 0;
  if (tiersNow <= claimed) return;

  const deltaTiers = tiersNow - claimed;
  const xp = deltaTiers * XP_AMOUNTS.fantasy_points_per_50;
  await awardUserXp({
    userId,
    delta: xp,
    reason: "fantasy_points_50",
    idempotencyKey: `fantasy_pts_tiers:${userId}:${claimed}->${tiersNow}`,
    metadata: { sumPoints, tiersNow, previousTiers: claimed },
  });

  const { data: after } = await admin
    .from("user_xp_state")
    .select("total_xp, login_streak, last_daily_login")
    .eq("user_id", userId)
    .maybeSingle();
  const a = after as { total_xp?: number; login_streak?: number; last_daily_login?: string | null } | null;

  await admin.from("user_xp_state").upsert(
    {
      user_id: userId,
      total_xp: a?.total_xp ?? 0,
      fantasy_points_tiers_claimed: tiersNow,
      login_streak: a?.login_streak ?? 0,
      last_daily_login: a?.last_daily_login ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
}
