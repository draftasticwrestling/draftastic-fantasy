import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getPwbsDisplayTitleForSlug } from "@/lib/pwbsChampionshipSlug.js";
import {
  addDaysYmd,
  priceSalaryCapRoster,
  SALARY_CAP_ACTIVITY_LOOKBACK_DAYS,
  type SalaryCapEventInput,
  type SalaryCapReignInput,
  type SalaryCapWrestlerInput,
} from "@/lib/salaryCapMonthlyPricing";
import { isValidSalaryCapCost } from "@/lib/salaryCap";

const EVENT_PAGE = 500;

export type SalaryCapPriceRefreshSummary = {
  asOfYmd: string;
  wrestlers: number;
  updated: number;
  unchanged: number;
  byCost: Record<number, number>;
  changes: Array<{ wrestlerId: string; name: string | null; from: number | null; to: number; reason: string }>;
};

function reignTitle(row: { championship_id?: string | null; title?: string | null }): string {
  const id = String(row.championship_id ?? "").trim();
  if (id) return getPwbsDisplayTitleForSlug(id) || id;
  return String(row.title ?? "").trim();
}

/**
 * Recompute global `wrestlers.salary_cap_cost` from titles and recent cards.
 * Does not touch league snapshots or roster locks. New leagues copy the column when they are created.
 */
export async function refreshSalaryCapPrices(
  admin: SupabaseClient,
  asOfYmd: string
): Promise<SalaryCapPriceRefreshSummary> {
  const asOf = asOfYmd.slice(0, 10);
  const since = addDaysYmd(asOf, -SALARY_CAP_ACTIVITY_LOOKBACK_DAYS);

  const { data: wrestlerRows, error: wrestlerError } = await admin
    .from("wrestlers")
    .select("id, name, brand, salary_cap_cost");
  if (wrestlerError) throw new Error(wrestlerError.message);
  const wrestlers = (wrestlerRows ?? []) as Array<
    SalaryCapWrestlerInput & { salary_cap_cost?: number | null }
  >;

  const { data: reignRows, error: reignError } = await admin
    .from("championship_history")
    .select("championship_id, champion, champion_slug, date_won, date_lost");
  if (reignError) throw new Error(reignError.message);
  const reigns: SalaryCapReignInput[] = ((reignRows ?? []) as Array<Record<string, unknown>>).map((row) => ({
    title: reignTitle(row as { championship_id?: string | null; title?: string | null }),
    champion: String(row.champion_slug ?? row.champion ?? ""),
    won: String(row.date_won ?? "").slice(0, 10),
    lost: row.date_lost ? String(row.date_lost).slice(0, 10) : null,
  }));

  const events: SalaryCapEventInput[] = [];
  for (let from = 0; ; from += EVENT_PAGE) {
    const { data, error } = await admin
      .from("events")
      .select("id, name, date, matches")
      .in("status", ["completed", "live"])
      .gte("date", since)
      .lt("date", asOf)
      .order("date", { ascending: true })
      .range(from, from + EVENT_PAGE - 1);
    if (error) throw new Error(error.message);
    const page = (data ?? []) as SalaryCapEventInput[];
    events.push(...page);
    if (page.length < EVENT_PAGE) break;
  }

  const priced = priceSalaryCapRoster({ asOfYmd: asOf, wrestlers, reigns, events });
  const currentById = new Map(
    wrestlers.map((wrestler) => [String(wrestler.id), wrestler.salary_cap_cost ?? null])
  );
  const nameById = new Map(wrestlers.map((wrestler) => [String(wrestler.id), wrestler.name ?? null]));

  const byCost: Record<number, number> = {};
  const changes: SalaryCapPriceRefreshSummary["changes"] = [];
  let updated = 0;
  let unchanged = 0;

  for (const price of priced) {
    byCost[price.cost] = (byCost[price.cost] ?? 0) + 1;
    const previous = currentById.get(price.wrestlerId);
    const previousCost = typeof previous === "number" && isValidSalaryCapCost(previous) ? previous : null;
    if (previousCost === price.cost) {
      unchanged += 1;
      continue;
    }
    const { error } = await admin
      .from("wrestlers")
      .update({ salary_cap_cost: price.cost })
      .eq("id", price.wrestlerId);
    if (error) throw new Error(error.message);
    updated += 1;
    if (changes.length < 80) {
      changes.push({
        wrestlerId: price.wrestlerId,
        name: nameById.get(price.wrestlerId) ?? null,
        from: previousCost,
        to: price.cost,
        reason: price.reason,
      });
    }
  }

  return { asOfYmd: asOf, wrestlers: priced.length, updated, unchanged, byCost, changes };
}
