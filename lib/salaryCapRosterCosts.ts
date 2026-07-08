import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getLeagueFrozenSalaryCosts,
  isNxtSalaryCapWrestler,
  SALARY_CAP_NXT_COST,
} from "@/lib/salaryCapSeedPricing";
import { isValidSalaryCapCost, salaryCapCostFromDb } from "@/lib/salaryCap";

export function lockedSalaryCapCostFromRosterRow(cost: unknown): number | null {
  return salaryCapCostFromDb(cost);
}

/** Roster stint cost: locked column, then league-frozen seed snapshot. NXT fallback only. */
export function resolveSalaryCapCostForRosterWrestler(params: {
  wrestlerId: string;
  lockedRosterCost: unknown;
  brand?: string | null;
  frozenCostsByWrestlerId: Record<string, number>;
}): number | null {
  const locked = lockedSalaryCapCostFromRosterRow(params.lockedRosterCost);
  if (locked != null) return locked;

  const frozen = params.frozenCostsByWrestlerId[params.wrestlerId];
  if (typeof frozen === "number" && isValidSalaryCapCost(frozen)) return frozen;

  if (isNxtSalaryCapWrestler(params.brand)) return SALARY_CAP_NXT_COST;
  return null;
}

/** Pool / FA display cost from league-frozen prices. */
export function resolveSalaryCapCostForLeaguePool(params: {
  wrestlerId: string;
  brand?: string | null;
  frozenCostsByWrestlerId: Record<string, number>;
}): number | null {
  return resolveSalaryCapCostForRosterWrestler({
    wrestlerId: params.wrestlerId,
    lockedRosterCost: null,
    brand: params.brand,
    frozenCostsByWrestlerId: params.frozenCostsByWrestlerId,
  });
}

export async function getLeagueFrozenSalaryCostsForRoster(
  supabase: Pick<SupabaseClient, "from">,
  leagueId: string
): Promise<Record<string, number>> {
  return getLeagueFrozenSalaryCosts(supabase, leagueId);
}
