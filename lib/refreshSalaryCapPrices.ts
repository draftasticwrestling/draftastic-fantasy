import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getPwbsDisplayTitleForSlug } from "@/lib/pwbsChampionshipSlug.js";
import {
  addDaysYmd,
  priceSalaryCapRoster,
  SALARY_CAP_RECENT_DAYS,
  salaryCapYearStart,
  type SalaryCapEventInput,
  type SalaryCapReignInput,
  type SalaryCapWindowStat,
  type SalaryCapWrestlerInput,
} from "@/lib/salaryCapMonthlyPricing";
import { isValidSalaryCapCost } from "@/lib/salaryCap";
import { aggregateWrestlerMatchStats, getMatchStatsForWrestler } from "@/lib/scoring/aggregateWrestlerMatchStats.js";
import { aggregateWrestlerPoints, getPointsForWrestler } from "@/lib/scoring/aggregateWrestlerPoints.js";
import { isMainEvent } from "@/lib/scoring/extractors/matches.js";
import { EVENT_TYPES, isNxtBrandEventType } from "@/lib/scoring/parsers/eventClassifier.js";
import { normalizeWrestlerName } from "@/lib/scoring/parsers/participantParser.js";
import { resolvePersonaToCanonical } from "@/lib/scoring/personaResolution.js";
import { scoreEvent } from "@/lib/scoring/scoreEvent.js";
import { brandByWrestlerSlugFromRows } from "@/lib/wrestlerBrandLookup";
import { isRawOrSmackDownWrestlerRoster } from "@/lib/wrestlerRosterFromBrand";

const EVENT_PAGE = 200;

export type SalaryCapPriceRefreshSummary = {
  asOfYmd: string;
  wrestlers: number;
  updated: number;
  unchanged: number;
  byCost: Record<number, number>;
  byReason: Record<string, number>;
  changes: Array<{ wrestlerId: string; name: string | null; from: number | null; to: number | null; reason: string }>;
};

type EventRow = { id: string; name: string; date: string; matches?: object[] | null };

function reignTitle(row: { championship_id?: string | null; title?: string | null }): string {
  const id = String(row.championship_id ?? "").trim();
  if (id) return getPwbsDisplayTitleForSlug(id) || id;
  return String(row.title ?? "").trim();
}

function windowStat(
  pointsBySlug: ReturnType<typeof aggregateWrestlerPoints>,
  statsBySlug: ReturnType<typeof aggregateWrestlerMatchStats>,
  wrestlerId: string,
  name: string | null | undefined
): SalaryCapWindowStat {
  const nameKey = normalizeWrestlerName(name ?? "");
  const points = getPointsForWrestler(pointsBySlug, wrestlerId, nameKey);
  const stats = getMatchStatsForWrestler(statsBySlug, wrestlerId, nameKey);
  return {
    matches: stats.mw,
    points: points.rsPoints + points.plePoints + points.beltPoints,
    mainEvents: 0,
  };
}

function countRecentMainEvents(params: {
  events: EventRow[];
  wrestlers: SalaryCapWrestlerInput[];
  recentByWrestlerId: Record<string, SalaryCapWindowStat>;
}): void {
  const idBySlug = new Map<string, string>();
  const brandById = new Map<string, string | null>();
  for (const wrestler of params.wrestlers) {
    const id = String(wrestler.id ?? "").trim();
    if (!id) continue;
    brandById.set(id, wrestler.brand ?? null);
    const idSlug = normalizeWrestlerName(id);
    if (idSlug) idBySlug.set(idSlug, id);
    const nameSlug = normalizeWrestlerName(wrestler.name ?? "");
    if (nameSlug) idBySlug.set(nameSlug, id);
  }

  for (const event of params.events) {
    const eventDate = String(event.date).slice(0, 10);
    const scored = scoreEvent(event) as {
      eventType?: string;
      matches?: Array<{ isPromo?: boolean; order?: number; wrestlerPoints?: Array<{ wrestler?: string }> }>;
    };
    const rawMatches = event.matches ?? [];
    const singleMainEventOnly =
      scored.eventType === EVENT_TYPES.SATURDAY_NIGHTS_MAIN_EVENT ||
      scored.eventType === EVENT_TYPES.WRESTLEPALOOZA;
    const nxtShow = isNxtBrandEventType(scored.eventType);

    (scored.matches ?? []).forEach((scoredMatch, index) => {
      if (scoredMatch.isPromo || !scoredMatch.wrestlerPoints?.length) return;
      const raw =
        rawMatches.find((match) => (match as { order?: number }).order === scoredMatch.order) ?? rawMatches[index];
      if (!raw || !isMainEvent(raw, rawMatches, singleMainEventOnly)) return;
      const seen = new Set<string>();
      for (const wp of scoredMatch.wrestlerPoints) {
        const rawSlug = normalizeWrestlerName(String(wp.wrestler ?? ""));
        if (!rawSlug) continue;
        const slug = resolvePersonaToCanonical(rawSlug, eventDate) || rawSlug;
        const id = idBySlug.get(slug);
        if (!id || seen.has(id)) continue;
        if (nxtShow && isRawOrSmackDownWrestlerRoster(brandById.get(id))) continue;
        seen.add(id);
        const stat = params.recentByWrestlerId[id];
        if (stat) stat.mainEvents = (stat.mainEvents ?? 0) + 1;
      }
    });
  }
}

export function salaryCapWindowsByWrestler(params: {
  asOfYmd: string;
  wrestlers: SalaryCapWrestlerInput[];
  events: EventRow[];
}): {
  yearByWrestlerId: Record<string, SalaryCapWindowStat>;
  recentByWrestlerId: Record<string, SalaryCapWindowStat>;
} {
  const asOf = params.asOfYmd.slice(0, 10);
  const yearStart = salaryCapYearStart(asOf);
  const recentStart = addDaysYmd(asOf, -SALARY_CAP_RECENT_DAYS);
  const scoredEvents = params.events.map((event) => ({
    id: event.id,
    name: event.name,
    date: String(event.date).slice(0, 10),
    matches: event.matches ?? undefined,
  }));
  const yearEvents = scoredEvents.filter((event) => event.date >= yearStart && event.date < asOf);
  const recentEvents = yearEvents.filter((event) => event.date >= recentStart);
  const brandBySlug = brandByWrestlerSlugFromRows(
    params.wrestlers.map((wrestler) => ({ id: wrestler.id, brand: wrestler.brand ?? null }))
  );
  const yearPoints = aggregateWrestlerPoints(yearEvents, brandBySlug);
  const yearStats = aggregateWrestlerMatchStats(yearEvents);
  const recentPoints = aggregateWrestlerPoints(recentEvents, brandBySlug);
  const recentStats = aggregateWrestlerMatchStats(recentEvents);

  const yearByWrestlerId: Record<string, SalaryCapWindowStat> = {};
  const recentByWrestlerId: Record<string, SalaryCapWindowStat> = {};
  for (const wrestler of params.wrestlers) {
    const id = String(wrestler.id ?? "").trim();
    if (!id) continue;
    yearByWrestlerId[id] = windowStat(yearPoints, yearStats, id, wrestler.name);
    recentByWrestlerId[id] = windowStat(recentPoints, recentStats, id, wrestler.name);
  }
  countRecentMainEvents({ events: recentEvents, wrestlers: params.wrestlers, recentByWrestlerId });
  return { yearByWrestlerId, recentByWrestlerId };
}

/**
 * Recompute global `wrestlers.salary_cap_cost` from this year's scoring and the last 90 days.
 * Does not touch league snapshots or roster locks. New leagues copy the column when they are created.
 */
export async function refreshSalaryCapPrices(
  admin: SupabaseClient,
  asOfYmd: string
): Promise<SalaryCapPriceRefreshSummary> {
  const asOf = asOfYmd.slice(0, 10);
  const yearStart = salaryCapYearStart(asOf);

  const { data: wrestlerRows, error: wrestlerError } = await admin
    .from("wrestlers")
    .select('id, name, brand, "Status", salary_cap_cost');
  if (wrestlerError) throw new Error(wrestlerError.message);
  const wrestlers = ((wrestlerRows ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id ?? ""),
    name: (row.name as string | null) ?? null,
    brand: (row.brand as string | null) ?? null,
    status: (row.Status as string | null) ?? null,
    salary_cap_cost: (row.salary_cap_cost as number | null) ?? null,
  }));

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
      .gte("date", yearStart)
      .lt("date", asOf)
      .order("date", { ascending: true })
      .range(from, from + EVENT_PAGE - 1);
    if (error) throw new Error(error.message);
    const page = (data ?? []) as SalaryCapEventInput[];
    events.push(...page);
    if (page.length < EVENT_PAGE) break;
  }

  const { yearByWrestlerId, recentByWrestlerId } = salaryCapWindowsByWrestler({
    asOfYmd: asOf,
    wrestlers,
    events: events as EventRow[],
  });
  const priced = priceSalaryCapRoster({
    asOfYmd: asOf,
    wrestlers,
    reigns,
    yearByWrestlerId,
    recentByWrestlerId,
  });
  const currentById = new Map(wrestlers.map((wrestler) => [wrestler.id, wrestler.salary_cap_cost]));
  const nameById = new Map(wrestlers.map((wrestler) => [wrestler.id, wrestler.name]));

  const byCost: Record<number, number> = {};
  const byReason: Record<string, number> = {};
  const changes: SalaryCapPriceRefreshSummary["changes"] = [];
  let updated = 0;
  let unchanged = 0;

  for (const price of priced) {
    byReason[price.reason] = (byReason[price.reason] ?? 0) + 1;
    if (typeof price.cost === "number") byCost[price.cost] = (byCost[price.cost] ?? 0) + 1;
    const previous = currentById.get(price.wrestlerId);
    const previousCost = typeof previous === "number" && isValidSalaryCapCost(previous) ? previous : null;
    const nextCost = price.cost;
    if (previousCost === nextCost) {
      unchanged += 1;
      continue;
    }
    const { error } = await admin.from("wrestlers").update({ salary_cap_cost: nextCost }).eq("id", price.wrestlerId);
    if (error) throw new Error(error.message);
    updated += 1;
    if (changes.length < 80) {
      changes.push({
        wrestlerId: price.wrestlerId,
        name: nameById.get(price.wrestlerId) ?? null,
        from: previousCost,
        to: nextCost,
        reason: price.reason,
      });
    }
  }

  return { asOfYmd: asOf, wrestlers: priced.length, updated, unchanged, byCost, byReason, changes };
}
