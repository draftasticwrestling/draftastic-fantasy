import type { SupabaseClient } from "@supabase/supabase-js";
import { EVENT_STATUSES_FOR_SCORING } from "@/lib/eventsScoring";
import { aggregateWrestlerPoints, getPointsForWrestler } from "@/lib/scoring/aggregateWrestlerPoints.js";
import { normalizeWrestlerName } from "@/lib/scoring/parsers/participantParser.js";
import { brandByWrestlerSlugFromRows } from "@/lib/wrestlerBrandLookup";

export type SalaryCap2026Stats = {
  rsPoints: number;
  plePoints: number;
  beltPoints: number;
  totalPoints: number;
  mw: number | null;
  wins: number | null;
  losses: number | null;
};

function rowToStats(row: {
  rs_points?: number | null;
  ple_points?: number | null;
  belt_points?: number | null;
  total_points?: number | null;
  mw?: number | null;
  win?: number | null;
  loss?: number | null;
}): SalaryCap2026Stats {
  const rs = Number(row.rs_points ?? 0);
  const ple = Number(row.ple_points ?? 0);
  const belt = Number(row.belt_points ?? 0);
  const total = Number(row.total_points ?? rs + ple + belt);
  return {
    rsPoints: rs,
    plePoints: ple,
    beltPoints: belt,
    totalPoints: total,
    mw: row.mw != null ? Number(row.mw) : null,
    wins: row.win != null ? Number(row.win) : null,
    losses: row.loss != null ? Number(row.loss) : null,
  };
}

/**
 * 2026 scoring snapshot for salary cap pool (cache first, live aggregate fallback).
 */
export async function loadSalaryCap2026StatsByWrestlerId(
  supabase: SupabaseClient,
  wrestlers: { id: string; name: string }[]
): Promise<Record<string, SalaryCap2026Stats>> {
  const out: Record<string, SalaryCap2026Stats> = {};
  if (wrestlers.length === 0) return out;

  const { data: cacheRows } = await supabase
    .from("wrestler_stats_cache")
    .select("wrestler_id, rs_points, ple_points, belt_points, total_points, mw, win, loss")
    .eq("season_key", "2026");

  const idSet = new Set(wrestlers.map((w) => w.id));
  for (const row of cacheRows ?? []) {
    const id = row.wrestler_id != null ? String(row.wrestler_id) : "";
    if (!id || !idSet.has(id)) continue;
    out[id] = rowToStats(row);
  }

  const missing = wrestlers.filter((w) => !out[w.id]);
  if (missing.length === 0) return out;

  const { data: events2026 } = await supabase
    .from("events")
    .select("id, name, date, matches")
    .in("status", [...EVENT_STATUSES_FOR_SCORING])
    .gte("date", "2026-01-01")
    .lte("date", "2026-12-31")
    .order("date", { ascending: true });

  const { data: brandRows } = await supabase.from("wrestlers").select("id, brand");
  const brandBySlug = brandByWrestlerSlugFromRows(
    (brandRows ?? []) as { id: string; brand: string | null }[]
  );
  const points2026BySlug = aggregateWrestlerPoints(
    (events2026 ?? []) as { id: string; name: string; date: string; matches?: object[] }[],
    brandBySlug
  );

  for (const w of missing) {
    const nameKey = w.name ? normalizeWrestlerName(w.name) : "";
    const pts = getPointsForWrestler(points2026BySlug, w.id, nameKey);
    out[w.id] = {
      rsPoints: pts.rsPoints,
      plePoints: pts.plePoints,
      beltPoints: pts.beltPoints,
      totalPoints: pts.rsPoints + pts.plePoints + pts.beltPoints,
      mw: null,
      wins: null,
      losses: null,
    };
  }

  return out;
}
