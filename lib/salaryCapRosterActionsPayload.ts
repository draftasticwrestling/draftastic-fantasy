import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getLeagueMembers, type League } from "@/lib/leagues";
import {
  getRosterRulesForLeague,
  leagueIncludesNxt,
  SALARY_CAP_BUDGET_DEFAULT,
  SALARY_CAP_MAX_ROSTER_SIZE,
} from "@/lib/leagueStructure";
import { getSalaryCapLeagueMeta, getSalaryCapSpentForUser } from "@/lib/salaryCap";
import {
  getLeagueFrozenSalaryCostsForRoster,
  resolveSalaryCapCostForRosterWrestler,
} from "@/lib/salaryCapRosterCosts";
import { FA_SALARY_CAP_WEEKLY_BUDGET, getSalaryCapWeeklyFaBudgetStatus } from "@/lib/salaryCapWeeklyLimits";
import type { SalaryCapRosterActionsConfig, SalaryCapRosterWrestler } from "@/lib/salaryCapRosterActionsTypes";

type WrestlerCostRow = { id: string; name: string | null; brand?: string | null };

const DEFAULT_SALARY_CAP_COST = 5;

export async function buildSalaryCapRosterActionsConfig(
  supabase: SupabaseClient,
  league: League,
  userId: string,
  myRosterIds: string[],
  wrestlers: WrestlerCostRow[],
  tradeLockedWrestlerIds: string[]
): Promise<SalaryCapRosterActionsConfig> {
  const wrestlerById = new Map(wrestlers.map((w) => [w.id, w]));

  const [meta, { spent }, weekly, members, frozenCostsByWrestlerId, rosterResult] = await Promise.all([
    getSalaryCapLeagueMeta(supabase, league.id),
    getSalaryCapSpentForUser(supabase, league.id, userId),
    getSalaryCapWeeklyFaBudgetStatus(supabase, league.id, userId),
    getLeagueMembers(league.id),
    getLeagueFrozenSalaryCostsForRoster(supabase, league.id),
    supabase
      .from("league_rosters")
      .select("wrestler_id, salary_cap_cost")
      .eq("league_id", league.id)
      .eq("user_id", userId)
      .is("released_at", null),
  ]);

  let rosterRows = rosterResult.data ?? [];
  if (rosterResult.error) {
    const fallback = await supabase
      .from("league_rosters")
      .select("wrestler_id")
      .eq("league_id", league.id)
      .eq("user_id", userId)
      .is("released_at", null);
    rosterRows = ((fallback.data ?? []) as Array<{ wrestler_id: string }>).map((r) => ({
      wrestler_id: r.wrestler_id,
      salary_cap_cost: null,
    }));
  }
  const lockedCostByWrestlerId = Object.fromEntries(
    rosterRows.map((r) => [
      (r as { wrestler_id: string }).wrestler_id,
      (r as { salary_cap_cost?: number | null }).salary_cap_cost,
    ])
  );

  const myRosterWrestlers: SalaryCapRosterWrestler[] = myRosterIds.map((id) => {
    const w = wrestlerById.get(id);
    const cost = resolveSalaryCapCostForRosterWrestler({
      wrestlerId: id,
      lockedRosterCost: lockedCostByWrestlerId[id],
      brand: w?.brand ?? null,
      frozenCostsByWrestlerId,
    });
    return {
      id,
      name: w?.name ?? null,
      salaryCapCost: cost ?? DEFAULT_SALARY_CAP_COST,
    };
  });

  const leagueBudget = (league as { salary_cap_budget?: number | null }).salary_cap_budget;
  const budget =
    meta?.budget ??
    (typeof leagueBudget === "number" && leagueBudget > 0 ? leagueBudget : SALARY_CAP_BUDGET_DEFAULT);

  const rosterRules = getRosterRulesForLeague(
    members.length,
    league.season_slug ?? null,
    leagueIncludesNxt(league),
    league.league_type ?? null
  );
  const rosterSize =
    rosterRules && rosterRules.rosterSize > 0
      ? rosterRules.rosterSize
      : SALARY_CAP_MAX_ROSTER_SIZE;

  return {
    myRosterIds,
    tradeLockedWrestlerIds,
    budget,
    spent,
    weeklyAddRemaining: weekly?.addRemaining ?? FA_SALARY_CAP_WEEKLY_BUDGET,
    rosterSize,
    myRosterWrestlers,
  };
}
