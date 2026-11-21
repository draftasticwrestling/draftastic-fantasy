import type { SupabaseClient } from "@supabase/supabase-js";

import { getPacificWeekBoundsUtc } from "@/lib/freeAgentSigningLimits";
import { getWrestlerSalaryCapCost } from "@/lib/salaryCap";
import {
  getLeagueFrozenSalaryCosts,
  isNxtSalaryCapWrestler,
  SALARY_CAP_NXT_COST,
} from "@/lib/salaryCapSeedPricing";

/** Max salary value (adds or drops) per faction per Pacific week in a standard salary-cap league. */
export const FA_SALARY_CAP_WEEKLY_BUDGET = 25;

/** Beat the Founders. $40 adds and $40 drops each week. */
export const FOUNDERS_LEAGUE_SLUG = "beat-the-founders-league";
/** Previous public address. Still recognized so the $40 limit applies before and after the rename. */
const LEGACY_FOUNDERS_LEAGUE_SLUG = "the-founders-league";
export const FOUNDERS_LEAGUE_WEEKLY_MOVE_BUDGET = 40;

function isFoundersLeagueSlug(slug: string | null | undefined): boolean {
  const s = String(slug ?? "").trim();
  return s === FOUNDERS_LEAGUE_SLUG || s === LEGACY_FOUNDERS_LEAGUE_SLUG;
}

function weeklyBudgetFromRow(row: { slug?: string | null; salary_cap_weekly_budget?: number | null } | null): number {
  const stored = row?.salary_cap_weekly_budget;
  if (typeof stored === "number" && stored > 0) return stored;
  if (isFoundersLeagueSlug(row?.slug)) return FOUNDERS_LEAGUE_WEEKLY_MOVE_BUDGET;
  return FA_SALARY_CAP_WEEKLY_BUDGET;
}

/** Per-league add budget and drop budget for the current Pacific week. */
export async function getSalaryCapWeeklyMoveBudget(
  supabase: Pick<SupabaseClient, "from">,
  leagueId: string
): Promise<number> {
  const withColumn = await supabase
    .from("leagues")
    .select("slug, salary_cap_weekly_budget")
    .eq("id", leagueId)
    .maybeSingle();
  if (!withColumn.error) {
    return weeklyBudgetFromRow(
      withColumn.data as { slug?: string | null; salary_cap_weekly_budget?: number | null } | null
    );
  }
  const slugOnly = await supabase.from("leagues").select("slug").eq("id", leagueId).maybeSingle();
  return weeklyBudgetFromRow(slugOnly.data as { slug?: string | null } | null);
}

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
  leagueId: string,
  ids: string[]
): Promise<Record<string, number>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return {};

  const frozenCosts = await getLeagueFrozenSalaryCosts(supabase, leagueId);
  const out: Record<string, number> = {};
  for (const id of unique) {
    const c = frozenCosts[id];
    if (typeof c === "number" && c > 0) {
      out[id] = c;
      continue;
    }
    const { data } = await supabase.from("wrestlers").select("brand").eq("id", id).maybeSingle();
    if (isNxtSalaryCapWrestler((data as { brand?: string | null } | null)?.brand)) {
      out[id] = SALARY_CAP_NXT_COST;
    }
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
  const costById = await loadCostsForWrestlerIds(supabase, leagueId, ids);
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
  const budget = await getSalaryCapWeeklyMoveBudget(supabase, leagueId);
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

  const budget = await getSalaryCapWeeklyMoveBudget(supabase, leagueId);
  const weekNote = "Monday–Sunday, Pacific Time";

  if (move.addWrestlerId) {
    const cost = await getWrestlerSalaryCapCost(supabase, move.addWrestlerId, leagueId);
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
    const cost = await getWrestlerSalaryCapCost(supabase, move.dropWrestlerId, leagueId);
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
