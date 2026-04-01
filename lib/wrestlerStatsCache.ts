import type { SupabaseClient } from "@supabase/supabase-js";

export type WrestlerStatsCacheSeasonKey = "all_time" | "2025" | "2026";

export type WrestlerStatsCacheRow = {
  season_key: WrestlerStatsCacheSeasonKey;
  wrestler_id: string;
  rs_points: number;
  ple_points: number;
  belt_points: number;
  total_points: number;
  mw: number;
  win: number;
  loss: number;
  nc: number;
  dqw: number;
  dql: number;
  updated_at: string;
};

/** Default 7 days; override with WRESTLER_STATS_CACHE_MAX_AGE_MS (milliseconds). */
export function getWrestlerStatsCacheMaxAgeMs(): number {
  const raw = process.env.WRESTLER_STATS_CACHE_MAX_AGE_MS;
  if (raw != null && raw !== "") {
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 7 * 24 * 60 * 60 * 1000;
}

export type WrestlerStatsCacheMaps = {
  all_time: Map<string, WrestlerStatsCacheRow>;
  "2025": Map<string, WrestlerStatsCacheRow>;
  "2026": Map<string, WrestlerStatsCacheRow>;
  maxUpdatedAt: string | null;
};

/**
 * Load precomputed stats for all wrestlers (three season keys). Returns null if the table
 * is missing or the query fails (caller should fall back to live aggregation).
 */
export async function loadWrestlerStatsCacheMaps(
  supabase: SupabaseClient
): Promise<WrestlerStatsCacheMaps | null> {
  const { data, error } = await supabase
    .from("wrestler_stats_cache")
    .select(
      "season_key, wrestler_id, rs_points, ple_points, belt_points, total_points, mw, win, loss, nc, dqw, dql, updated_at"
    )
    .in("season_key", ["all_time", "2025", "2026"]);

  if (error) {
    console.warn("[wrestler_stats_cache] read failed, using live compute:", error.message);
    return null;
  }

  const rows = (data ?? []) as WrestlerStatsCacheRow[];
  const all_time = new Map<string, WrestlerStatsCacheRow>();
  const y2025 = new Map<string, WrestlerStatsCacheRow>();
  const y2026 = new Map<string, WrestlerStatsCacheRow>();
  let maxTs = 0;
  let maxUpdatedAt: string | null = null;

  for (const r of rows) {
    if (r.updated_at) {
      const t = Date.parse(r.updated_at);
      if (Number.isFinite(t) && t >= maxTs) {
        maxTs = t;
        maxUpdatedAt = r.updated_at;
      }
    }
    const id = String(r.wrestler_id);
    if (r.season_key === "all_time") all_time.set(id, r);
    else if (r.season_key === "2025") y2025.set(id, r);
    else if (r.season_key === "2026") y2026.set(id, r);
  }

  return { all_time, "2025": y2025, "2026": y2026, maxUpdatedAt };
}

/**
 * Cache is usable when every wrestler has three rows and the newest row is within max age.
 * "Stale" or incomplete maps return false so callers recompute from events.matches.
 */
export function isWrestlerStatsCacheUsable(
  maps: WrestlerStatsCacheMaps,
  wrestlerIds: string[],
  nowMs: number = Date.now()
): boolean {
  if (wrestlerIds.length === 0) return false;
  const maxAge = getWrestlerStatsCacheMaxAgeMs();
  if (!maps.maxUpdatedAt) return false;
  const age = nowMs - Date.parse(maps.maxUpdatedAt);
  if (!Number.isFinite(age) || age > maxAge) return false;

  for (const id of wrestlerIds) {
    const key = String(id);
    if (!maps.all_time.has(key) || !maps["2025"].has(key) || !maps["2026"].has(key)) {
      return false;
    }
  }
  return true;
}
