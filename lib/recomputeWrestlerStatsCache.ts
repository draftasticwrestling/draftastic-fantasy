import type { SupabaseClient } from "@supabase/supabase-js";
import { EVENT_STATUSES_FOR_SCORING } from "@/lib/eventsScoring";
import { aggregateWrestlerPoints, getPointsForWrestler } from "@/lib/scoring/aggregateWrestlerPoints.js";
import { aggregateWrestlerMatchStats, getMatchStatsForWrestler } from "@/lib/scoring/aggregateWrestlerMatchStats.js";
import {
  computeHybridBeltHoldBySlugForCalendarYear,
  computeHybridPublicBeltHoldBySlug,
  getMonthlyBeltForWrestler,
} from "@/lib/scoring/endOfMonthBeltPoints.js";
import { normalizeWrestlerName } from "@/lib/scoring/parsers/participantParser.js";

type EventRow = { id: string; name: string; date: string; matches?: object[] | undefined };
type WrestlerRow = { id: string; name?: string | null };
type ChampionshipReign = Record<string, unknown>;

const ALL_TIME_FROM = "2025-01-01";
const SEASONS = [
  { key: "all_time", from: "2025-01-01", to: null as string | null },
  { key: "2025", from: "2025-01-01", to: "2025-12-31" },
  { key: "2026", from: "2026-01-01", to: null as string | null },
] as const;

function inRange(date: string, from: string, to: string | null): boolean {
  if (date < from) return false;
  if (to && date > to) return false;
  return true;
}

export async function recomputeWrestlerStatsCache(supabase: SupabaseClient) {
  const [wrestlersRes, eventsRes, reignsRes] = await Promise.all([
    supabase.from("wrestlers").select("id, name"),
    supabase
      .from("events")
      .select("id, name, date, matches")
      .in("status", [...EVENT_STATUSES_FOR_SCORING])
      .gte("date", ALL_TIME_FROM)
      .order("date", { ascending: true }),
    supabase.from("championship_history").select("*"),
  ]);
  if (wrestlersRes.error) throw wrestlersRes.error;
  if (eventsRes.error) throw eventsRes.error;
  if (reignsRes.error) throw reignsRes.error;

  const wrestlers = (wrestlersRes.data ?? []) as WrestlerRow[];
  const eventsAll = ((eventsRes.data ?? []) as Array<{ id: string; name: string; date: string; matches?: object[] | null }>).map((e) => ({
    id: e.id,
    name: e.name,
    date: e.date,
    matches: e.matches ?? undefined,
  })) as EventRow[];
  const reigns = (reignsRes.data ?? []) as ChampionshipReign[];

  const upsertRows: Array<Record<string, unknown>> = [];
  const nowIso = new Date().toISOString();

  for (const season of SEASONS) {
    const seasonEvents = eventsAll.filter((e) => inRange(e.date, season.from, season.to));
    const pointsBySlug = aggregateWrestlerPoints(seasonEvents);
    const statsBySlug = aggregateWrestlerMatchStats(seasonEvents);
    const beltBySlug =
      season.key === "all_time"
        ? computeHybridPublicBeltHoldBySlug(reigns)
        : season.key === "2025"
          ? computeHybridBeltHoldBySlugForCalendarYear(reigns, 2025)
          : computeHybridBeltHoldBySlugForCalendarYear(reigns, 2026);

    for (const w of wrestlers) {
      const slugKey = w.id;
      const nameKey = w.name ? normalizeWrestlerName(w.name) : "";
      const points = getPointsForWrestler(pointsBySlug, slugKey, nameKey);
      const stats = getMatchStatsForWrestler(statsBySlug, slugKey, nameKey);
      const extraBelt = getMonthlyBeltForWrestler(beltBySlug, slugKey, nameKey);
      const beltPoints = points.beltPoints + extraBelt;

      upsertRows.push({
        season_key: season.key,
        wrestler_id: slugKey,
        rs_points: points.rsPoints,
        ple_points: points.plePoints,
        belt_points: beltPoints,
        total_points: points.rsPoints + points.plePoints + beltPoints,
        mw: stats.mw,
        win: stats.win,
        loss: stats.loss,
        nc: stats.nc,
        dqw: stats.dqw,
        dql: stats.dql,
        updated_at: nowIso,
      });
    }
  }

  const chunkSize = 500;
  for (let i = 0; i < upsertRows.length; i += chunkSize) {
    const chunk = upsertRows.slice(i, i + chunkSize);
    const { error } = await supabase.from("wrestler_stats_cache").upsert(chunk, { onConflict: "season_key,wrestler_id" });
    if (error) throw error;
  }

  return { wrestlers: wrestlers.length, events: eventsAll.length, rows: upsertRows.length };
}

