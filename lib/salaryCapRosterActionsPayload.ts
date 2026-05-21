import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getLeagueMembers, type League } from "@/lib/leagues";
import {
  getRosterRulesForLeague,
  leagueIncludesNxt,
  SALARY_CAP_BUDGET_DEFAULT,
  SALARY_CAP_MAX_ROSTER_SIZE,
} from "@/lib/leagueStructure";
import { getSalaryCapLeagueMeta, getSalaryCapSpentForUser, salaryCapCostFromDb } from "@/lib/salaryCap";
import { FA_SALARY_CAP_WEEKLY_BUDGET, getSalaryCapWeeklyFaBudgetStatus } from "@/lib/salaryCapWeeklyLimits";
import type { SalaryCapRosterActionsConfig, SalaryCapRosterWrestler } from "@/lib/salaryCapRosterActionsTypes";

type WrestlerCostRow = { id: string; name: string | null; salary_cap_cost?: unknown };

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

  const myRosterWrestlers: SalaryCapRosterWrestler[] = myRosterIds.map((id) => {
    const w = wrestlerById.get(id);
    return {
      id,
      name: w?.name ?? null,
      salaryCapCost: salaryCapCostFromDb(w?.salary_cap_cost) ?? DEFAULT_SALARY_CAP_COST,
    };
  });

  const [meta, { spent }, weekly, members] = await Promise.all([
    getSalaryCapLeagueMeta(supabase, league.id),
    getSalaryCapSpentForUser(supabase, league.id, userId),
    getSalaryCapWeeklyFaBudgetStatus(supabase, league.id, userId),
    getLeagueMembers(league.id),
  ]);

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
