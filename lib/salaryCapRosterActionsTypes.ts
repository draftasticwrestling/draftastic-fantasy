/** Shared types for salary cap Add/Drop on league wrestler tables (client + server). */

export type SalaryCapRosterWrestler = {
  id: string;
  name: string | null;
  salaryCapCost: number;
};

export type SalaryCapRosterActionsConfig = {
  myRosterIds: string[];
  tradeLockedWrestlerIds: string[];
  budget: number;
  spent: number;
  weeklyAddRemaining: number;
  rosterSize: number;
  myRosterWrestlers: SalaryCapRosterWrestler[];
};

export function isSalaryCapRosterActionsConfig(
  value: unknown
): value is SalaryCapRosterActionsConfig {
  return (
    value != null &&
    typeof value === "object" &&
    "budget" in value &&
    typeof (value as SalaryCapRosterActionsConfig).budget === "number"
  );
}
