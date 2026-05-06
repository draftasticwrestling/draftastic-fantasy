import "server-only";

import { getAdminClient } from "@/lib/supabase/admin";
import { getPointsByOwnerForLeagueWithBonuses } from "@/lib/leagueMatchups";
import { awardUserXp } from "@/lib/xp/awardUserXp";
import { XP_AMOUNTS } from "@/lib/xp/xpReasons";

/** Default: full cross-league tier pass at most once per 12h per user (league home is throttled). */
const DEFAULT_FULL_CHECK_COOLDOWN_MS = 12 * 60 * 60 * 1000;

type RefreshOpts = {
  /** Bypass cooldown (weekly cron, account XP section, etc.). */
  force?: boolean;
};

/**
 * Sums this user's fantasy points across non-archived leagues and awards
 * +10 XP for each new block of 50 points since the last check.
 * @returns true if a full scan ran (DB may or may not have changed tier XP).
 */
export async function refreshFantasyPointsTiersForUser(userId: string, opts?: RefreshOpts): Promise<boolean> {
  const admin = getAdminClient();
  if (!admin) return false;

  const { data: stateRow } = await admin
    .from("user_xp_state")
    .select(
      "fantasy_points_tiers_claimed, total_xp, login_streak, last_daily_login, fantasy_pts_tier_last_full_check_at"
    )
    .eq("user_id", userId)
    .maybeSingle();
  const st = stateRow as {
    fantasy_points_tiers_claimed?: number;
    total_xp?: number;
    login_streak?: number;
    last_daily_login?: string | null;
    fantasy_pts_tier_last_full_check_at?: string | null;
  } | null;

  const lastCheck = st?.fantasy_pts_tier_last_full_check_at;
  if (!opts?.force && lastCheck) {
    const age = Date.now() - new Date(lastCheck).getTime();
    if (age >= 0 && age < DEFAULT_FULL_CHECK_COOLDOWN_MS) return false;
  }

  const { data: memberships } = await admin
    .from("league_members")
    .select("league_id, leagues!inner(id, is_archived)")
    .eq("user_id", userId);
  const rows = (memberships ?? []) as { league_id: string; leagues?: { is_archived?: boolean | null } | null }[];
  const leagueIds = [
    ...new Set(rows.filter((r) => !(r.leagues?.is_archived ?? false)).map((r) => r.league_id)),
  ];

  let sumPoints = 0;
  for (const leagueId of leagueIds) {
    const byOwner = await getPointsByOwnerForLeagueWithBonuses(leagueId);
    sumPoints += byOwner[userId] ?? 0;
  }

  const tiersNow = Math.floor(sumPoints / 50);
  const claimed = st?.fantasy_points_tiers_claimed ?? 0;
  const nowIso = new Date().toISOString();

  if (tiersNow > claimed) {
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
        fantasy_pts_tier_last_full_check_at: nowIso,
        login_streak: a?.login_streak ?? 0,
        last_daily_login: a?.last_daily_login ?? null,
        updated_at: nowIso,
      },
      { onConflict: "user_id" }
    );
    return true;
  }

  if (st) {
    await admin
      .from("user_xp_state")
      .update({
        fantasy_pts_tier_last_full_check_at: nowIso,
        updated_at: nowIso,
      })
      .eq("user_id", userId);
  } else {
    await admin.from("user_xp_state").insert({
      user_id: userId,
      fantasy_pts_tier_last_full_check_at: nowIso,
      updated_at: nowIso,
    });
  }

  return true;
}
