import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  SALARY_CAP_BUDGET_DEFAULT,
  SALARY_CAP_COST_TIERS,
  getActivePerEvent,
  leagueUsesSalaryCap,
} from "@/lib/leagueStructure";

export { SALARY_CAP_BUDGET_DEFAULT, SALARY_CAP_COST_TIERS, leagueUsesSalaryCap };

export function isValidSalaryCapCost(n: number): boolean {
  return (SALARY_CAP_COST_TIERS as readonly number[]).includes(n);
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

export async function getWrestlerSalaryCapCost(
  supabase: Pick<SupabaseClient, "from">,
  wrestlerId: string
): Promise<number | null> {
  const { data } = await supabase
    .from("wrestlers")
    .select("salary_cap_cost")
    .eq("id", wrestlerId)
    .maybeSingle();
  const cost = (data as { salary_cap_cost?: number | null } | null)?.salary_cap_cost;
  return typeof cost === "number" && isValidSalaryCapCost(cost) ? cost : null;
}

/** Sum of salary_cap_cost for a member's active roster. */
export async function getSalaryCapSpentForUser(
  supabase: Pick<SupabaseClient, "from">,
  leagueId: string,
  userId: string
): Promise<{ spent: number; rosterIds: string[] }> {
  const { data: rosterRows } = await supabase
    .from("league_rosters")
    .select("wrestler_id")
    .eq("league_id", leagueId)
    .eq("user_id", userId)
    .is("released_at", null);
  const rosterIds = (rosterRows ?? []).map((r) => (r as { wrestler_id: string }).wrestler_id);
  if (rosterIds.length === 0) return { spent: 0, rosterIds: [] };

  const { data: wrestlers } = await supabase
    .from("wrestlers")
    .select("id, salary_cap_cost")
    .in("id", rosterIds);
  let spent = 0;
  for (const w of wrestlers ?? []) {
    const row = w as { salary_cap_cost?: number | null };
    const c = row.salary_cap_cost;
    if (typeof c === "number" && isValidSalaryCapCost(c)) spent += c;
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

  const cost = await getWrestlerSalaryCapCost(supabase, wrestlerId);
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
