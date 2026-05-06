import "server-only";

import { getAdminClient } from "@/lib/supabase/admin";
import { awardUserXp } from "@/lib/xp/awardUserXp";
import { XP_AMOUNTS } from "@/lib/xp/xpReasons";

function utcTodayYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayYmd(today: string): string {
  const d = new Date(`${today}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Awards daily login + streak milestone XP (UTC calendar days). Updates streak columns in user_xp_state.
 */
export async function processDailyLoginXp(userId: string): Promise<void> {
  const admin = getAdminClient();
  if (!admin) return;

  const today = utcTodayYmd();

  const { data: stateRow } = await admin
    .from("user_xp_state")
    .select("login_streak, last_daily_login, total_xp, fantasy_points_tiers_claimed")
    .eq("user_id", userId)
    .maybeSingle();
  const row = stateRow as {
    login_streak?: number;
    last_daily_login?: string | null;
    total_xp?: number;
    fantasy_points_tiers_claimed?: number;
  } | null;

  const last = row?.last_daily_login ?? null;
  if (last === today) return;

  let streak = row?.login_streak ?? 0;
  if (last === yesterdayYmd(today)) streak += 1;
  else streak = 1;

  await awardUserXp({
    userId,
    delta: XP_AMOUNTS.daily_login,
    reason: "daily_login",
    idempotencyKey: `daily_login:${userId}:${today}`,
  });

  if (streak === 3) {
    await awardUserXp({
      userId,
      delta: XP_AMOUNTS.login_streak_3,
      reason: "login_streak_3",
      idempotencyKey: `login_streak_3:${userId}:${today}`,
    });
  }
  if (streak === 10) {
    await awardUserXp({
      userId,
      delta: XP_AMOUNTS.login_streak_10,
      reason: "login_streak_10",
      idempotencyKey: `login_streak_10:${userId}:${today}`,
    });
  }
  if (streak === 30) {
    await awardUserXp({
      userId,
      delta: XP_AMOUNTS.login_streak_30,
      reason: "login_streak_30",
      idempotencyKey: `login_streak_30:${userId}:${today}`,
    });
  }

  const { data: after } = await admin.from("user_xp_state").select("total_xp, fantasy_points_tiers_claimed").eq("user_id", userId).maybeSingle();
  const a = after as { total_xp?: number; fantasy_points_tiers_claimed?: number } | null;

  await admin.from("user_xp_state").upsert(
    {
      user_id: userId,
      total_xp: a?.total_xp ?? 0,
      fantasy_points_tiers_claimed: a?.fantasy_points_tiers_claimed ?? 0,
      login_streak: streak,
      last_daily_login: today,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
}
