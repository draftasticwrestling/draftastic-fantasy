import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  SALARY_CAP_BUDGET_DEFAULT,
  SALARY_CAP_COST_TIERS,
  getActivePerEvent,
  leagueUsesSalaryCap,
} from "@/lib/leagueStructure";
import { getLeagueSnapshotSalaryCost, leagueHasSalarySnapshots } from "@/lib/leagueSalarySnapshots";
import {
  getLeagueFrozenSalaryCosts,
  isNxtSalaryCapWrestler,
  SALARY_CAP_NXT_COST,
} from "@/lib/salaryCapSeedPricing";
import { lockedSalaryCapCostFromRosterRow } from "@/lib/salaryCapRosterCosts";

export { SALARY_CAP_BUDGET_DEFAULT, SALARY_CAP_COST_TIERS, leagueUsesSalaryCap };
export { FA_SALARY_CAP_WEEKLY_BUDGET } from "@/lib/salaryCapWeeklyLimits";

export function isValidSalaryCapCost(n: number): boolean {
  return (SALARY_CAP_COST_TIERS as readonly number[]).includes(n);
}

/** Parse `wrestlers.salary_cap_cost` for display (league tables, etc.). */
export function salaryCapCostFromDb(value: unknown): number | null {
  return typeof value === "number" && isValidSalaryCapCost(value) ? value : null;
}

export type SalaryCapLeagueMeta = {
  budget: number;
  leagueType: string | null;
};

export async function getSalaryCapLeagueMeta(
  supabase: Pick<SupabaseClient, "from">,
  leagueId: string
): Promise<SalaryCapLeagueMeta | null> {
  const { data } = await supabase
    .from("leagues")
    .select("league_type, salary_cap_budget")
    .eq("id", leagueId)
    .maybeSingle();
  if (!data) return null;
  const row = data as { league_type?: string | null; salary_cap_budget?: number | null };
  if (!leagueUsesSalaryCap(row.league_type)) return null;
  const budget =
    typeof row.salary_cap_budget === "number" && row.salary_cap_budget > 0
      ? row.salary_cap_budget
      : SALARY_CAP_BUDGET_DEFAULT;
  return { budget, leagueType: row.league_type ?? null };
}

export async function getLeagueSalaryCapCostContext(
  supabase: Pick<SupabaseClient, "from">,
  leagueId: string
): Promise<{ frozenCostsByWrestlerId: Record<string, number> }> {
  const frozenCostsByWrestlerId = await getLeagueFrozenSalaryCosts(supabase, leagueId);
  return { frozenCostsByWrestlerId };
}

/** Resolve pool/roster cost from league-frozen seed snapshot. NXT fallback only. */
export function resolveSalaryCapCostForLeague(
  wrestlerId: string,
  brand: string | null | undefined,
  frozenCostsByWrestlerId: Record<string, number>
): number | null {
  const frozen = frozenCostsByWrestlerId[wrestlerId];
  if (typeof frozen === "number" && isValidSalaryCapCost(frozen)) return frozen;
  if (isNxtSalaryCapWrestler(brand)) return SALARY_CAP_NXT_COST;
  return null;
}

export async function getWrestlerSalaryCapCost(
  supabase: Pick<SupabaseClient, "from">,
  wrestlerId: string,
  leagueId?: string
): Promise<number | null> {
  if (!leagueId) return null;

  const snap = await getLeagueSnapshotSalaryCost(supabase, leagueId, wrestlerId);
  if (snap != null) return snap;

  if (await leagueHasSalarySnapshots(supabase, leagueId)) {
    const { data } = await supabase.from("wrestlers").select("brand").eq("id", wrestlerId).maybeSingle();
    if (isNxtSalaryCapWrestler((data as { brand?: string | null } | null)?.brand)) {
      return SALARY_CAP_NXT_COST;
    }
    return null;
  }

  const frozen = await getLeagueFrozenSalaryCosts(supabase, leagueId);
  const cost = frozen[wrestlerId];
  if (typeof cost === "number" && isValidSalaryCapCost(cost)) return cost;

  const { data } = await supabase.from("wrestlers").select("brand").eq("id", wrestlerId).maybeSingle();
  if (isNxtSalaryCapWrestler((data as { brand?: string | null } | null)?.brand)) {
    return SALARY_CAP_NXT_COST;
  }
  return null;
}

/** Sum of league-frozen values for a member's active roster. */
export async function getSalaryCapSpentForUser(
  supabase: Pick<SupabaseClient, "from">,
  leagueId: string,
  userId: string
): Promise<{ spent: number; rosterIds: string[] }> {
  let rosterRows: Array<{ wrestler_id: string; salary_cap_cost?: number | null }> = [];
  const withCost = await supabase
    .from("league_rosters")
    .select("wrestler_id, salary_cap_cost")
    .eq("league_id", leagueId)
    .eq("user_id", userId)
    .is("released_at", null);
  if (!withCost.error) {
    rosterRows = (withCost.data ?? []) as typeof rosterRows;
  } else {
    const withoutCost = await supabase
      .from("league_rosters")
      .select("wrestler_id")
      .eq("league_id", leagueId)
      .eq("user_id", userId)
      .is("released_at", null);
    rosterRows = ((withoutCost.data ?? []) as Array<{ wrestler_id: string }>).map((r) => ({
      wrestler_id: r.wrestler_id,
      salary_cap_cost: null,
    }));
  }

  const rosterIds = rosterRows.map((r) => r.wrestler_id);
  if (rosterIds.length === 0) return { spent: 0, rosterIds: [] };

  const frozenCosts = await getLeagueFrozenSalaryCosts(supabase, leagueId);

  const needsBrandFallback = rosterRows.some((row) => {
    if (lockedSalaryCapCostFromRosterRow(row.salary_cap_cost) != null) return false;
    const frozen = frozenCosts[row.wrestler_id];
    return !(typeof frozen === "number" && isValidSalaryCapCost(frozen));
  });

  let brandByWrestlerId: Record<string, string | null> = {};
  if (needsBrandFallback) {
    const { data: wrestlers } = await supabase.from("wrestlers").select("id, brand").in("id", rosterIds);
    for (const w of wrestlers ?? []) {
      const row = w as { id: string; brand?: string | null };
      brandByWrestlerId[row.id] = row.brand ?? null;
    }
  }

  let spent = 0;
  for (const row of rosterRows) {
    const locked = lockedSalaryCapCostFromRosterRow(row.salary_cap_cost);
    if (locked != null) {
      spent += locked;
      continue;
    }
    const frozen = frozenCosts[row.wrestler_id];
    if (typeof frozen === "number" && isValidSalaryCapCost(frozen)) {
      spent += frozen;
      continue;
    }
    if (isNxtSalaryCapWrestler(brandByWrestlerId[row.wrestler_id])) {
      spent += SALARY_CAP_NXT_COST;
    }
  }

  return { spent, rosterIds };
}

export async function validateSalaryCapAdd(
  supabase: Pick<SupabaseClient, "from">,
  leagueId: string,
  userId: string,
  wrestlerId: string
): Promise<{ error?: string; cost?: number; remaining?: number }> {
  const meta = await getSalaryCapLeagueMeta(supabase, leagueId);
  if (!meta) return { error: "Not a salary cap league." };

  const cost = await getWrestlerSalaryCapCost(supabase, wrestlerId, leagueId);
  if (cost == null) {
    return { error: "This wrestler does not have a salary cap value assigned yet." };
  }

  const { spent } = await getSalaryCapSpentForUser(supabase, leagueId, userId);
  const remaining = meta.budget - spent;
  if (cost > remaining) {
    return {
      error: `Not enough cap room ($${remaining} left; this wrestler costs $${cost}).`,
      cost,
      remaining,
    };
  }
  return { cost, remaining: remaining - cost };
}

/** Active lineup size from actual roster count (salary cap rosters vary in size). */
export function getActivePerEventForSalaryCapRosterCount(rosterCount: number): number {
  if (rosterCount <= 0) return 0;
  const capped = Math.min(rosterCount, 15);
  return getActivePerEvent(capped) ?? getActivePerEvent(12) ?? 7;
}
