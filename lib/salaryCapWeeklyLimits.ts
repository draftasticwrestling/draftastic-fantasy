import type { SupabaseClient } from "@supabase/supabase-js";

import { getPacificWeekBoundsUtc } from "@/lib/freeAgentSigningLimits";
import { getWrestlerSalaryCapCost } from "@/lib/salaryCap";

/** Max salary value (adds or drops) per faction per Pacific week in salary-cap leagues. */
export const FA_SALARY_CAP_WEEKLY_BUDGET = 25;

export type SalaryCapWeeklyFaSpend = {
  addSpent: number;
  dropSpent: number;
};

export type SalaryCapWeeklyFaBudgetStatus = SalaryCapWeeklyFaSpend & {
  addRemaining: number;
  dropRemaining: number;
  budget: number;
};

type ActivityRow = {
  activity_type: string;
  wrestler_id: string;
  secondary_wrestler_id: string | null;
};

async function loadCostsForWrestlerIds(
  supabase: Pick<SupabaseClient, "from">,
  ids: string[]
): Promise<Record<string, number>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return {};

  const { data, error } = await supabase.from("wrestlers").select("id, salary_cap_cost").in("id", unique);
  if (error) {
    console.error("[salaryCapWeeklyLimits] wrestlers:", error.message);
    return {};
  }

  const out: Record<string, number> = {};
  for (const row of data ?? []) {
    const r = row as { id: string; salary_cap_cost?: number | null };
    const c = r.salary_cap_cost;
    if (typeof c === "number" && c > 0) out[r.id] = c;
  }
  return out;
}

function sumSpendFromActivities(
  activities: ActivityRow[],
  costById: Record<string, number>
): SalaryCapWeeklyFaSpend {
  let addSpent = 0;
  let dropSpent = 0;

  for (const row of activities) {
    if (row.activity_type === "drop") {
      dropSpent += costById[row.wrestler_id] ?? 0;
      continue;
    }
    if (row.activity_type === "fa_add") {
      addSpent += costById[row.wrestler_id] ?? 0;
      if (row.secondary_wrestler_id) {
        dropSpent += costById[row.secondary_wrestler_id] ?? 0;
      }
    }
  }

  return { addSpent, dropSpent };
}

/** Sum `fa_add` and `drop` salary values in the current Pacific week (Monday 00:00 PT). */
export async function getSalaryCapWeeklyFaSpend(
  supabase: Pick<SupabaseClient, "from">,
  leagueId: string,
  userId: string,
  refNowMs = Date.now()
): Promise<SalaryCapWeeklyFaSpend | null> {
  const { startIso, endExclusiveIso } = getPacificWeekBoundsUtc(refNowMs);

  const { data, error } = await supabase
    .from("league_activity")
    .select("activity_type, wrestler_id, secondary_wrestler_id")
    .eq("league_id", leagueId)
    .eq("user_id", userId)
    .in("activity_type", ["fa_add", "drop"])
    .gte("created_at", startIso)
    .lt("created_at", endExclusiveIso);

  if (error) {
    console.error("[salaryCapWeeklyLimits] league_activity:", error.message);
    return null;
  }

  const activities = (data ?? []) as ActivityRow[];
  const ids: string[] = [];
  for (const row of activities) {
    ids.push(row.wrestler_id);
    if (row.secondary_wrestler_id) ids.push(row.secondary_wrestler_id);
  }
  const costById = await loadCostsForWrestlerIds(supabase, ids);
  return sumSpendFromActivities(activities, costById);
}

export async function getSalaryCapWeeklyFaBudgetStatus(
  supabase: Pick<SupabaseClient, "from">,
  leagueId: string,
  userId: string,
  refNowMs = Date.now()
): Promise<SalaryCapWeeklyFaBudgetStatus | null> {
  const spend = await getSalaryCapWeeklyFaSpend(supabase, leagueId, userId, refNowMs);
  if (!spend) return null;
  const budget = FA_SALARY_CAP_WEEKLY_BUDGET;
  return {
    ...spend,
    budget,
    addRemaining: Math.max(0, budget - spend.addSpent),
    dropRemaining: Math.max(0, budget - spend.dropSpent),
  };
}

export type SalaryCapWeeklyFaMove = {
  addWrestlerId?: string | null;
  dropWrestlerId?: string | null;
};

export async function assertSalaryCapWeeklyFaMoveAllowed(
  supabase: Pick<SupabaseClient, "from">,
  leagueId: string,
  userId: string,
  move: SalaryCapWeeklyFaMove
): Promise<{ error?: string }> {
  const spend = await getSalaryCapWeeklyFaSpend(supabase, leagueId, userId);
  if (!spend) {
    return { error: "Could not verify weekly free agent budget. Try again." };
  }

  const budget = FA_SALARY_CAP_WEEKLY_BUDGET;
  const weekNote = "Monday–Sunday, Pacific Time";

  if (move.addWrestlerId) {
    const cost = await getWrestlerSalaryCapCost(supabase, move.addWrestlerId);
    if (cost == null) {
      return { error: "This wrestler does not have a salary cap value assigned yet." };
    }
    if (spend.addSpent + cost > budget) {
      const left = Math.max(0, budget - spend.addSpent);
      return {
        error: `You've used $${spend.addSpent} of $${budget} in free agent adds this week (${weekNote}). This wrestler costs $${cost}; only $${left} remains for adds.`,
      };
    }
  }

  if (move.dropWrestlerId) {
    const cost = await getWrestlerSalaryCapCost(supabase, move.dropWrestlerId);
    if (cost == null) {
      return { error: "This wrestler does not have a salary cap value assigned yet." };
    }
    if (spend.dropSpent + cost > budget) {
      const left = Math.max(0, budget - spend.dropSpent);
      return {
        error: `You've used $${spend.dropSpent} of $${budget} in roster drops this week (${weekNote}). Dropping them would use $${cost}; only $${left} remains for drops.`,
      };
    }
  }

  return {};
}
