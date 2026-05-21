import type { SupabaseClient } from "@supabase/supabase-js";
import { addWeeks, startOfWeek } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";

import { leagueUsesSalaryCap, leagueUsesWeeklyPstBeltHold } from "@/lib/leagueStructure";
import { FA_SIGNINGS_PER_WEEK } from "@/lib/publicLeagueRosterRules";
import { BELT_HOLD_TIMEZONE } from "@/lib/pstCivilTime";
import {
  assertSalaryCapWeeklyFaMoveAllowed,
  type SalaryCapWeeklyFaMove,
} from "@/lib/salaryCapWeeklyLimits";

/**
 * Half-open UTC window [start, end) for the Pacific calendar week containing refNowMs:
 * Monday 00:00 through next Monday 00:00 in America/Los_Angeles (DST-aware).
 */
export function getPacificWeekBoundsUtc(refNowMs = Date.now()): {
  startIso: string;
  endExclusiveIso: string;
} {
  const ref = new Date(refNowMs);
  const laNow = toZonedTime(ref, BELT_HOLD_TIMEZONE);
  const mondayLa = startOfWeek(laNow, { weekStartsOn: 1 });
  const nextMondayLa = addWeeks(mondayLa, 1);
  const startUtc = fromZonedTime(mondayLa, BELT_HOLD_TIMEZONE);
  const endExclusiveUtc = fromZonedTime(nextMondayLa, BELT_HOLD_TIMEZONE);
  return {
    startIso: startUtc.toISOString(),
    endExclusiveIso: endExclusiveUtc.toISOString(),
  };
}

/**
 * Count `fa_add` rows in league_activity for this league/user in the Pacific (PT) week
 * containing `refNowMs` (Monday 00:00 PT through next Monday 00:00 PT).
 */
export async function countFaSigningsInPacificWeek(
  supabase: Pick<SupabaseClient, "from">,
  leagueId: string,
  userId: string,
  refNowMs = Date.now()
): Promise<number | null> {
  const { startIso, endExclusiveIso } = getPacificWeekBoundsUtc(refNowMs);

  const { count, error } = await supabase
    .from("league_activity")
    .select("id", { count: "exact", head: true })
    .eq("league_id", leagueId)
    .eq("user_id", userId)
    .eq("activity_type", "fa_add")
    .gte("created_at", startIso)
    .lt("created_at", endExclusiveIso);

  if (error) {
    console.error("[freeAgentSigningLimits] count league_activity:", error.message);
    return null;
  }
  return count ?? 0;
}

export type FaSigningLimitMove = SalaryCapWeeklyFaMove;

/** Salary cap: $25 signings + $25 drops per Pacific week. RTS/RTSS: 2 signings/week. */
export async function assertFaSigningAllowedForLeague(
  supabase: Pick<SupabaseClient, "from">,
  leagueId: string,
  userId: string,
  seasonSlug: string | null | undefined,
  leagueType?: string | null,
  move?: FaSigningLimitMove
): Promise<{ error?: string }> {
  if (leagueUsesSalaryCap(leagueType)) {
    return assertSalaryCapWeeklyFaMoveAllowed(supabase, leagueId, userId, {
      addWrestlerId: move?.addWrestlerId,
      dropWrestlerId: move?.dropWrestlerId,
    });
  }

  if (!leagueUsesWeeklyPstBeltHold(seasonSlug)) return {};

  const n = await countFaSigningsInPacificWeek(supabase, leagueId, userId);
  if (n === null) {
    return { error: "Could not verify free agent signing limit. Try again." };
  }
  if (n >= FA_SIGNINGS_PER_WEEK) {
    return {
      error: `You've reached the limit of ${FA_SIGNINGS_PER_WEEK} free agent signings for this week (Monday–Sunday, Pacific Time). Standalone drops do not count toward this limit. Trades are unlimited.`,
    };
  }
  return {};
}
