import type { SalaryCapWeeklyFaBudgetStatus } from "@/lib/salaryCapWeeklyLimits";

type Props = {
  status: SalaryCapWeeklyFaBudgetStatus;
};

export function SalaryCapWeeklyFaBudget({ status }: Props) {
  const { budget, addSpent, dropSpent, addRemaining, dropRemaining } = status;

  return (
    <p
      style={{
        fontSize: 14,
        color: "var(--color-text-muted)",
        marginBottom: 12,
        padding: "10px 12px",
        borderRadius: 8,
        background: "var(--color-bg-elevated)",
        border: "1px solid var(--color-border)",
        maxWidth: 640,
      }}
    >
      <strong>Weekly roster moves</strong> (resets Monday, Pacific Time): up to ${budget} in adds and ${budget} in
      drops per week. You have <strong>${addRemaining}</strong> left to add (${addSpent} used) and{" "}
      <strong>${dropRemaining}</strong> left to drop ({dropSpent} used). Moves can be spread across the week. Trades are
      unlimited.
    </p>
  );
}
