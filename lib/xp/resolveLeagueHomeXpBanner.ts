import "server-only";

import { getAdminClient } from "@/lib/supabase/admin";
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

/** One-time replay targets users at level 3+ (strictly above level 2). */
const MIN_LEVEL_FOR_ONE_TIME_REPLAY = 3;

function replayDoneFromRow(row: unknown): boolean {
  const v = (row as { xp_league_banner_level_replay_done?: unknown } | null)
    ?.xp_league_banner_level_replay_done;
  return v === true;
}

function lastCelebratedLevelFromRow(row: unknown): number | null {
  const v = (row as { xp_league_banner_last_celebrated_level?: unknown } | null)
    ?.xp_league_banner_last_celebrated_level;
  if (v == null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return Math.max(1, Math.trunc(v));
  const n = Number.parseInt(String(v), 10);
  return Number.isFinite(n) ? Math.max(1, n) : null;
}

async function syncLastCelebratedLevel(userId: string, level: number, opts?: { markReplayDone?: boolean }): Promise<void> {
  const admin = getAdminClient();
  if (!admin) return;
  const now = new Date().toISOString();
  const { data: row } = await admin.from("user_xp_state").select("user_id").eq("user_id", userId).maybeSingle();
  const patch: Record<string, unknown> = {
    xp_league_banner_last_celebrated_level: level,
    updated_at: now,
  };
  if (opts?.markReplayDone) patch.xp_league_banner_level_replay_done = true;
  if (row) {
    await admin.from("user_xp_state").update(patch).eq("user_id", userId);
  } else {
    await admin.from("user_xp_state").insert({
      user_id: userId,
      ...patch,
    });
  }
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
 * League home: tier refresh (may award XP), one-time intro banner, then level-up when current level
 * exceeds the last celebrated level (XP may have been earned on any page, not only this visit).
 */
export async function resolveLeagueHomeXpBanner(userId: string): Promise<ResolveLeagueHomeXpBannerResult> {
  const admin = getAdminClient();
  if (!admin) return { celebration: null, kind: null };

  const xpStateSelect =
    "total_xp, xp_league_banner_intro_seen, xp_league_banner_last_celebrated_level, xp_league_banner_level_replay_done";

  const { data: beforeRow } = await admin
    .from("user_xp_state")
    .select(xpStateSelect)
    .eq("user_id", userId)
    .maybeSingle();

  const introSeen = introSeenFromRow(beforeRow);
  const lastCelebrated = lastCelebratedLevelFromRow(beforeRow);
  const replayDoneBefore = replayDoneFromRow(beforeRow);

  await refreshFantasyPointsTiersForUser(userId);

  const { data: afterRow } = await admin
    .from("user_xp_state")
    .select(xpStateSelect)
    .eq("user_id", userId)
    .maybeSingle();

  const afterXp = readTotalXp(afterRow);
  const afterInfo = getXpLevelInfo(afterXp);
  const currentLevel = afterInfo.level;
  const replayDone = replayDoneFromRow(afterRow) || replayDoneBefore;

  if (!introSeen) {
    return { celebration: celebrationForLevel(afterInfo), kind: "intro" };
  }

  const eligibleForReplay = currentLevel >= MIN_LEVEL_FOR_ONE_TIME_REPLAY && !replayDone;

  if (lastCelebrated != null && currentLevel > lastCelebrated) {
    return { celebration: celebrationForLevel(afterInfo), kind: "level_up" };
  }

  if (eligibleForReplay) {
    return { celebration: celebrationForLevel(afterInfo), kind: "replay" };
  }

  // Level 1–2 or replay already done: backfill last_celebrated without showing a banner.
  if (lastCelebrated == null) {
    await syncLastCelebratedLevel(userId, currentLevel, {
      markReplayDone: currentLevel < MIN_LEVEL_FOR_ONE_TIME_REPLAY,
    });
  }

  return { celebration: null, kind: null };
}
