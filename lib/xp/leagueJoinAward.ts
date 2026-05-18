import "server-only";

import { getAdminClient } from "@/lib/supabase/admin";
import { awardUserXp } from "@/lib/xp/awardUserXp";
import { XP_AMOUNTS } from "@/lib/xp/xpReasons";

/**
 * Award XP for joining a league (not for creating one — use maybeAwardLeagueStartedXp when the league reaches 3 factions).
 */
export async function awardLeagueJoinXp(userId: string, leagueSlug: string): Promise<void> {
  const slug = leagueSlug?.trim();
  if (!slug || !userId) return;
  const admin = getAdminClient();
  if (!admin) return;
  const { data: league } = await admin.from("leagues").select("id").eq("slug", slug).maybeSingle();
  const leagueId = (league as { id?: string } | null)?.id;
  if (!leagueId) return;
  await awardUserXp({
    userId,
    delta: XP_AMOUNTS.league_joined,
    reason: "league_joined",
    idempotencyKey: `league_joined:${userId}:${leagueId}`,
    metadata: { leagueId, slug },
  });
}
