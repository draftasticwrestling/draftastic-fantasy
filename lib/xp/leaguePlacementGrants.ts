import type { SupabaseClient } from "@supabase/supabase-js";
import { applyXpGrant } from "@/lib/xp/applyXpGrant";
import { XP_AMOUNTS } from "@/lib/xp/xpReasons";

export type LeagueTeamCount = 3 | 4 | 5 | 6;

/** 3–5 use their own amounts. A win in a league of 6 or more pays the 6-team amount (950). */
export function leaguePlacementXpTier(teamCount: number): LeagueTeamCount | null {
  if (!Number.isInteger(teamCount) || teamCount < 3) return null;
  if (teamCount >= 6) return 6;
  return teamCount as LeagueTeamCount;
}

function placementToken(placement: 1 | 2): "1st" | "2nd" {
  return placement === 1 ? "1st" : "2nd";
}

/**
 * True if this user already received 1st/2nd placement XP for this league under any seasonKey.
 * Season-key strings have drifted historically (slug vs slug-year), which bypassed exact
 * idempotency keys — so we match on league + user + place, not the full key.
 */
export async function hasLeaguePlacementXp(
  admin: SupabaseClient,
  args: { userId: string; leagueId: string; placement: 1 | 2 }
): Promise<boolean> {
  const { userId, leagueId, placement } = args;
  const place = placementToken(placement);
  const { data } = await admin
    .from("user_xp_ledger")
    .select("id, idempotency_key")
    .eq("user_id", userId)
    .like("idempotency_key", `league_place:${leagueId}:%`)
    .limit(40);
  const needle = `:${userId}:${place}:`;
  return (data ?? []).some((r) => String((r as { idempotency_key?: string }).idempotency_key ?? "").includes(needle));
}

/** Idempotent placement XP; pass a service-role Supabase client (e.g. from scripts). */
export async function applyLeaguePlacementXp(
  admin: SupabaseClient,
  args: {
    userId: string;
    leagueId: string;
    seasonKey: string;
    placement: 1 | 2;
    /** Factions in the league. 6 or more pays the 6-team amount. */
    teamCount: number;
  }
): Promise<void> {
  const { userId, leagueId, seasonKey, placement, teamCount } = args;
  const tier = leaguePlacementXpTier(teamCount);
  if (!tier) return;
  // Runner-up XP stays on the published 3–6 ladder. Wins of 6+ all use the 6-team amount.
  if (placement === 2 && teamCount > 6) return;

  if (await hasLeaguePlacementXp(admin, { userId, leagueId, placement })) {
    return;
  }

  const idBase = `league_place:${leagueId}:${seasonKey}:${userId}`;
  if (placement === 2) {
    const key =
      tier === 3
        ? "league_second_3"
        : tier === 4
          ? "league_second_4"
          : tier === 5
            ? "league_second_5"
            : "league_second_6";
    const amt =
      tier === 3
        ? XP_AMOUNTS.league_second_3
        : tier === 4
          ? XP_AMOUNTS.league_second_4
          : tier === 5
            ? XP_AMOUNTS.league_second_5
            : XP_AMOUNTS.league_second_6;
    await applyXpGrant(admin, {
      userId,
      delta: amt,
      reason: key,
      idempotencyKey: `${idBase}:2nd:${teamCount}`,
      metadata: { leagueId, teamCount, xpTier: tier },
    });
    return;
  }
  const key = tier === 3 ? "league_win_3" : tier === 4 ? "league_win_4" : tier === 5 ? "league_win_5" : "league_win_6";
  const amt =
    tier === 3
      ? XP_AMOUNTS.league_win_3
      : tier === 4
        ? XP_AMOUNTS.league_win_4
        : tier === 5
          ? XP_AMOUNTS.league_win_5
          : XP_AMOUNTS.league_win_6;
  await applyXpGrant(admin, {
    userId,
    delta: amt,
    reason: key,
    idempotencyKey: `${idBase}:1st:${teamCount}`,
    metadata: { leagueId, teamCount, xpTier: tier },
  });
}
