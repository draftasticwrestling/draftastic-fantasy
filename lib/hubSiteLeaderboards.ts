import "server-only";

import { unstable_cache } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  getMondayOfWeek,
  getPointsByOwnerForLeagueWeekFromMatchups,
  getPointsByOwnerForLeagueWithBonuses,
} from "@/lib/leagueMatchups";
import { getCurrentWeekStartMondayPst, shiftWeekStartMonday } from "@/lib/weeklyLeaderboards";
import type { HubLeaderboardDisplayRow, HubSiteLeaderboardsPayload } from "@/lib/hubSiteLeaderboardsTypes";
import { getAdminClient } from "@/lib/supabase/admin";

function chunkIds(ids: string[], size: number): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < ids.length; i += size) out.push(ids.slice(i, i + size));
  return out;
}

/** Run an async task for each item with at most `limit` in-flight at once. */
async function mapConcurrent<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await fn(items[i]);
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, worker);
  await Promise.all(workers);
  return results;
}

function mapToTop10(totals: Map<string, number>): { userId: string; points: number }[] {
  return [...totals.entries()]
    .map(([userId, points]) => ({ userId, points: Number(points || 0) }))
    .sort((a, b) => b.points - a.points || a.userId.localeCompare(b.userId))
    .slice(0, 10);
}

/** Top 10 with positive points only (weekly in-progress week should not list ten zeros). */
function mapToTop10Positive(totals: Map<string, number>): { userId: string; points: number }[] {
  return [...totals.entries()]
    .map(([userId, points]) => ({ userId, points: Number(points || 0) }))
    .filter((r) => r.points > 0)
    .sort((a, b) => b.points - a.points || a.userId.localeCompare(b.userId))
    .slice(0, 10);
}

async function loadActiveCompletedLeagueIds(admin: NonNullable<ReturnType<typeof getAdminClient>>): Promise<string[]> {
  const { data, error } = await admin
    .from("leagues")
    .select("id")
    .eq("is_archived", false)
    .eq("draft_status", "completed");
  if (error || !data) return [];
  return (data as { id: string }[]).map((r) => r.id);
}

async function loadDisplayLabels(
  admin: NonNullable<ReturnType<typeof getAdminClient>>,
  userIds: string[]
): Promise<Map<string, string>> {
  const unique = [...new Set(userIds)].filter(Boolean);
  const labels = new Map<string, string>();
  if (unique.length === 0) return labels;

  const idChunks = chunkIds(unique, 100);
  for (const chunk of idChunks) {
    const { data, error } = await admin.from("profiles").select("id, display_name").in("id", chunk);
    if (error || !data) continue;
    for (const row of data as Array<{ id: string; display_name: string | null }>) {
      const name = row.display_name?.trim();
      labels.set(row.id, name || "Player");
    }
  }
  for (const id of unique) {
    if (!labels.has(id)) labels.set(id, "Player");
  }
  return labels;
}

function toDisplayRows(
  top: { userId: string; points: number }[],
  labels: Map<string, string>
): HubLeaderboardDisplayRow[] {
  return top.map((r, idx) => ({
    userId: r.userId,
    points: r.points,
    rank: idx + 1,
    label: labels.get(r.userId) ?? "Player",
  }));
}

const HUB_LEADERBOARD_CONCURRENCY = 4;

/**
 * Hub “Most points this season”: per user, their **highest** season-to-date total in any one league (never summed
 * across leagues). Same scoring as that league’s home total.
 */
async function aggregateLiveSeasonByUser(admin: SupabaseClient, leagueIds: string[]): Promise<Map<string, number>> {
  const userMax = new Map<string, number>();
  await mapConcurrent(leagueIds, HUB_LEADERBOARD_CONCURRENCY, async (leagueId) => {
    const byOwner = await getPointsByOwnerForLeagueWithBonuses(leagueId, admin);
    for (const [uid, pts] of Object.entries(byOwner)) {
      const p = Number(pts ?? 0);
      const prev = userMax.get(uid) ?? 0;
      if (p > prev) userMax.set(uid, p);
    }
  });
  return userMax;
}

/**
 * Hub “Most points this week”: per user, their **highest** Mon–Sun week total in any one league (never summed across
 * leagues). Uses matchup-week scoring — event points, title-hold belt in that week, and weekly win / Draftastic belt
 * bonuses when the league format applies them (`getPointsByOwnerForLeagueWeekFromMatchups`).
 */
async function aggregateLiveWeeklyByUser(
  admin: SupabaseClient,
  leagueIds: string[],
  weekStartMonday: string
): Promise<Map<string, number>> {
  const userMax = new Map<string, number>();
  await mapConcurrent(leagueIds, HUB_LEADERBOARD_CONCURRENCY, async (leagueId) => {
    const byOwner = await getPointsByOwnerForLeagueWeekFromMatchups(leagueId, weekStartMonday, admin);
    for (const [uid, pts] of Object.entries(byOwner)) {
      const p = Number(pts ?? 0);
      const prev = userMax.get(uid) ?? 0;
      if (p > prev) userMax.set(uid, p);
    }
  });
  return userMax;
}

const HUB_LEADERBOARD_WEEK_LOOKBACK = 52;

export function normalizeHubLeaderboardWeekStart(
  raw: string | null | undefined,
  currentMondayPst: string
): string {
  if (!raw?.trim()) {
    return currentMondayPst;
  }
  const m = raw.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(m)) {
    return currentMondayPst;
  }
  let mon = getMondayOfWeek(m);
  if (mon > currentMondayPst) mon = currentMondayPst;
  const oldest = shiftWeekStartMonday(currentMondayPst, -HUB_LEADERBOARD_WEEK_LOOKBACK);
  if (mon < oldest) mon = oldest;
  return mon;
}

/**
 * Heavy path: all leagues × scoring; cached per `selectedWeekStart` (args are part of the cache key).
 * Set `HUB_LEADERBOARD_MAX_LEAGUES` (integer) locally to cap work if you have many test leagues.
 */
async function computeHubSiteLeaderboardsForWeek(selectedWeekStart: string): Promise<HubSiteLeaderboardsPayload> {
  const admin = getAdminClient();
  if (!admin) {
    return {
      weekStart: null,
      currentWeekStartMondayPst: null,
      weeklyPrevWeekStart: null,
      weeklyNextWeekStart: null,
      weeklyTop10: [],
      seasonTop10: [],
      hubLeaderboardsAvailable: false,
    };
  }

  const currentMondayPst = getCurrentWeekStartMondayPst();
  const oldest = shiftWeekStartMonday(currentMondayPst, -HUB_LEADERBOARD_WEEK_LOOKBACK);
  const prevStart = shiftWeekStartMonday(selectedWeekStart, -1);
  const nextStart = shiftWeekStartMonday(selectedWeekStart, 1);
  const weeklyPrevWeekStart = prevStart >= oldest ? prevStart : null;
  const weeklyNextWeekStart = nextStart <= currentMondayPst ? nextStart : null;

  let leagueIds = await loadActiveCompletedLeagueIds(admin);
  const maxLeagues = Number.parseInt(process.env.HUB_LEADERBOARD_MAX_LEAGUES ?? "", 10);
  if (Number.isFinite(maxLeagues) && maxLeagues > 0 && leagueIds.length > maxLeagues) {
    leagueIds = leagueIds.slice(0, maxLeagues);
  }
  if (leagueIds.length === 0) {
    return {
      weekStart: selectedWeekStart,
      currentWeekStartMondayPst: currentMondayPst,
      weeklyPrevWeekStart,
      weeklyNextWeekStart,
      weeklyTop10: [],
      seasonTop10: [],
      hubLeaderboardsAvailable: true,
    };
  }

  const [seasonTotals, weeklyTotals] = await Promise.all([
    aggregateLiveSeasonByUser(admin, leagueIds),
    aggregateLiveWeeklyByUser(admin, leagueIds, selectedWeekStart),
  ]);

  const weeklyTop = mapToTop10Positive(weeklyTotals);
  const seasonTop = mapToTop10(seasonTotals);

  const labelIds = [...weeklyTop.map((r) => r.userId), ...seasonTop.map((r) => r.userId)];
  const labels = await loadDisplayLabels(admin, labelIds);

  return {
    weekStart: selectedWeekStart,
    currentWeekStartMondayPst: currentMondayPst,
    weeklyPrevWeekStart,
    weeklyNextWeekStart,
    weeklyTop10: toDisplayRows(weeklyTop, labels),
    seasonTop10: toDisplayRows(seasonTop, labels),
    hubLeaderboardsAvailable: true,
  };
}

const getHubSiteLeaderboardsCached = unstable_cache(
  async (selectedWeekStart: string) => computeHubSiteLeaderboardsForWeek(selectedWeekStart),
  ["hub-site-leaderboards-by-week"],
  { revalidate: 180 }
);

/**
 * Site-wide hub leaderboards (non-archived leagues, completed draft).
 *
 * - Season: max over leagues of that user’s season-to-date points in the league (never sum across leagues).
 * - Weekly: max over leagues of that user’s points for the selected Mon–Sun week (PT), all categories the matchup
 *   chart includes for that week (including weekly belt where applicable).
 */
export async function getHubSiteLeaderboards(opts?: {
  leaderboardWeek?: string | null;
}): Promise<HubSiteLeaderboardsPayload> {
  const admin = getAdminClient();
  if (!admin) {
    return {
      weekStart: null,
      currentWeekStartMondayPst: null,
      weeklyPrevWeekStart: null,
      weeklyNextWeekStart: null,
      weeklyTop10: [],
      seasonTop10: [],
      hubLeaderboardsAvailable: false,
    };
  }

  const currentMondayPst = getCurrentWeekStartMondayPst();
  const selectedWeekStart = normalizeHubLeaderboardWeekStart(opts?.leaderboardWeek ?? null, currentMondayPst);

  return getHubSiteLeaderboardsCached(selectedWeekStart);
}

