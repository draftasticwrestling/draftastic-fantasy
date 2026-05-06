import "server-only";

import { awardUserXp } from "@/lib/xp/awardUserXp";
import { applyLeaguePlacementXp, type LeagueTeamCount } from "@/lib/xp/leaguePlacementGrants";
import { getAdminClient } from "@/lib/supabase/admin";
import { XP_AMOUNTS } from "@/lib/xp/xpReasons";

export type { LeagueTeamCount };

/**
 * Call from a season-end job or admin action. Idempotent per league + user + season key.
 */
export async function awardLeaguePlacementXp(args: {
  userId: string;
  leagueId: string;
  seasonKey: string;
  placement: 1 | 2;
  teamCount: LeagueTeamCount;
}): Promise<void> {
  const admin = getAdminClient();
  if (!admin) return;
  await applyLeaguePlacementXp(admin, args);
}

/** Weekly high score in a league (idempotent per league + scoring week key). */
export async function awardWeeklyHighScoreXp(args: {
  userId: string;
  leagueId: string;
  weekKey: string;
}): Promise<void> {
  const { userId, leagueId, weekKey } = args;
  await awardUserXp({
    userId,
    delta: XP_AMOUNTS.weekly_high_score,
    reason: "weekly_high_score",
    idempotencyKey: `weekly_high:${leagueId}:${weekKey}:${userId}`,
    metadata: { leagueId, weekKey },
  });
}
