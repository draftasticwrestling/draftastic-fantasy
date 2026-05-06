import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getXpLevelInfo } from "@/lib/xp/xpLevels";
import { refreshFantasyPointsTiersForUser } from "@/lib/xp/refreshFantasyPointsTiers";
import { getXpLevelUpFlavor, type LevelUpCelebration } from "@/lib/xp/xpLevelUpFlavor";
import type { LeagueHomeXpBannerKind } from "@/lib/xp/leagueHomeXpBannerKind";

export type ResolveLeagueHomeXpBannerResult = {
  celebration: LevelUpCelebration | null;
  kind: LeagueHomeXpBannerKind | null;
};

function readTotalXp(row: unknown): number {
  const v = (row as { total_xp?: unknown } | null)?.total_xp;
  if (v == null) return 0;
  if (typeof v === "number") return Math.max(0, Math.trunc(v));
  const n = Number.parseInt(String(v), 10);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

function introSeenFromRow(row: unknown): boolean {
  const v = (row as { xp_league_banner_intro_seen?: unknown } | null)?.xp_league_banner_intro_seen;
  return v === true;
}

function celebrationForLevel(levelInfo: ReturnType<typeof getXpLevelInfo>): LevelUpCelebration {
  const flavor = getXpLevelUpFlavor(levelInfo.level);
  return {
    level: levelInfo.level,
    title: levelInfo.title,
    label: levelInfo.label,
    flavor: flavor || `You're at ${levelInfo.label}.`,
  };
}

/**
 * League home: optional tier refresh (throttled), one-time intro banner, then real level-ups only after a full check.
 */
export async function resolveLeagueHomeXpBanner(
  userId: string,
  supabase: SupabaseClient
): Promise<ResolveLeagueHomeXpBannerResult> {
  const { data: beforeRow } = await supabase
    .from("user_xp_state")
    .select("total_xp, xp_league_banner_intro_seen")
    .eq("user_id", userId)
    .maybeSingle();

  const introSeen = introSeenFromRow(beforeRow);
  const beforeXp = readTotalXp(beforeRow);
  const beforeLevel = getXpLevelInfo(beforeXp).level;

  const ranFullCheck = await refreshFantasyPointsTiersForUser(userId);

  const { data: afterRow } = await supabase.from("user_xp_state").select("total_xp").eq("user_id", userId).maybeSingle();
  const afterXp = readTotalXp(afterRow);
  const afterInfo = getXpLevelInfo(afterXp);

  if (!introSeen) {
    return { celebration: celebrationForLevel(afterInfo), kind: "intro" };
  }

  if (ranFullCheck && afterInfo.level > beforeLevel) {
    return { celebration: celebrationForLevel(afterInfo), kind: "level_up" };
  }

  return { celebration: null, kind: null };
}
