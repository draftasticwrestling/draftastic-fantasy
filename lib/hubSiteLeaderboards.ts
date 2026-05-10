import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  getPointsByOwnerForLeagueForWeek,
  getPointsByOwnerForLeagueWithBonuses,
} from "@/lib/leagueMatchups";
import { getCurrentWeekStartMondayPst, type LeaderboardDisplayRow } from "@/lib/weeklyLeaderboards";
import { getAdminClient } from "@/lib/supabase/admin";

const LEAGUE_ID_CHUNK = 80;
const SNAPSHOT_PAGE = 1000;

function chunkIds(ids: string[], size: number): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < ids.length; i += size) out.push(ids.slice(i, i + size));
  return out;
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

const LEAGUE_USER_SEP = "\x1f";

/** For each user, keep their best single-league total (map keys = `leagueId` + sep + `userId`). */
function perLeagueUserTotalsToUserBest(perLeagueUser: Map<string, number>): Map<string, number> {
  const userMax = new Map<string, number>();
  for (const [k, pts] of perLeagueUser) {
    const idx = k.indexOf(LEAGUE_USER_SEP);
    const userId = idx === -1 ? k : k.slice(idx + LEAGUE_USER_SEP.length);
    const p = Number(pts || 0);
    const prev = userMax.get(userId) ?? 0;
    if (p > prev) userMax.set(userId, p);
  }
  return userMax;
}

/** One fantasy week from snapshots: each user's best single-league score that week. */
async function maxPointsByUserForWeekFromSnapshots(
  admin: NonNullable<ReturnType<typeof getAdminClient>>,
  leagueChunks: string[][],
  weekStart: string
): Promise<Map<string, number>> {
  const perLeagueUser = new Map<string, number>();
  for (const chunk of leagueChunks) {
    let from = 0;
    for (;;) {
      const { data, error } = await admin
        .from("league_weekly_points_snapshot")
        .select("league_id, user_id, points")
        .in("league_id", chunk)
        .eq("week_start", weekStart)
        .range(from, from + SNAPSHOT_PAGE - 1);
      if (error) break;
      const rows = (data ?? []) as Array<{
        league_id: string;
        user_id: string;
        points: number | null;
      }>;
      for (const r of rows) {
        const key = `${r.league_id}${LEAGUE_USER_SEP}${r.user_id}`;
        perLeagueUser.set(key, (perLeagueUser.get(key) ?? 0) + Number(r.points ?? 0));
      }
      if (rows.length < SNAPSHOT_PAGE) break;
      from += SNAPSHOT_PAGE;
    }
  }
  return perLeagueUserTotalsToUserBest(perLeagueUser);
}

/** Per-user season total from snapshots: each user's best single-league tally (not summed across leagues). */
async function maxSeasonPointsByUserFromSnapshots(
  admin: NonNullable<ReturnType<typeof getAdminClient>>,
  leagueChunks: string[][]
): Promise<Map<string, number>> {
  const perLeagueUser = new Map<string, number>();
  for (const chunk of leagueChunks) {
    let from = 0;
    for (;;) {
      const { data, error } = await admin
        .from("league_weekly_points_snapshot")
        .select("league_id, user_id, points")
        .in("league_id", chunk)
        .range(from, from + SNAPSHOT_PAGE - 1);
      if (error) break;
      const rows = (data ?? []) as Array<{
        league_id: string;
        user_id: string;
        points: number | null;
      }>;
      for (const r of rows) {
        const k = `${r.league_id}${LEAGUE_USER_SEP}${r.user_id}`;
        perLeagueUser.set(k, (perLeagueUser.get(k) ?? 0) + Number(r.points ?? 0));
      }
      if (rows.length < SNAPSHOT_PAGE) break;
      from += SNAPSHOT_PAGE;
    }
  }
  return perLeagueUserTotalsToUserBest(perLeagueUser);
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
): LeaderboardDisplayRow[] {
  return top.map((r, idx) => ({
    userId: r.userId,
    points: r.points,
    rank: idx + 1,
    label: labels.get(r.userId) ?? "Player",
  }));
}

/** Live season: each user's highest single-league total (same scoring as league home, max not sum). */
async function aggregateLiveSeasonByUser(admin: SupabaseClient, leagueIds: string[]): Promise<Map<string, number>> {
  const userMax = new Map<string, number>();
  await Promise.all(
    leagueIds.map(async (leagueId) => {
      const byOwner = await getPointsByOwnerForLeagueWithBonuses(leagueId, admin);
      for (const [uid, pts] of Object.entries(byOwner)) {
        const p = Number(pts ?? 0);
        const prev = userMax.get(uid) ?? 0;
        if (p > prev) userMax.set(uid, p);
      }
    })
  );
  return userMax;
}

/** Live weekly: each user's best single-league score that week (same scoring as league matchups). */
async function aggregateLiveWeeklyByUser(
  admin: SupabaseClient,
  leagueIds: string[],
  weekStartMonday: string
): Promise<Map<string, number>> {
  const userMax = new Map<string, number>();
  await Promise.all(
    leagueIds.map(async (leagueId) => {
      const byOwner = await getPointsByOwnerForLeagueForWeek(leagueId, weekStartMonday, admin);
      for (const [uid, pts] of Object.entries(byOwner)) {
        const p = Number(pts ?? 0);
        const prev = userMax.get(uid) ?? 0;
        if (p > prev) userMax.set(uid, p);
      }
    })
  );
  return userMax;
}

/**
 * Site-wide fantasy leaderboards for non-archived leagues with completed drafts.
 * Season and weekly: each user's best single-league tally (fair for multi-league managers).
 * Weekly uses the current Mon–Sun week (America/Los_Angeles); live scoring until snapshots exist for that week.
 */
export async function getHubSiteLeaderboards(): Promise<{
  weekStart: string | null;
  weeklyTop10: LeaderboardDisplayRow[];
  seasonTop10: LeaderboardDisplayRow[];
  /** False when service role is missing; hide the block in that case. */
  hubLeaderboardsAvailable: boolean;
}> {
  const admin = getAdminClient();
  if (!admin) {
    return { weekStart: null, weeklyTop10: [], seasonTop10: [], hubLeaderboardsAvailable: false };
  }

  const leagueIds = await loadActiveCompletedLeagueIds(admin);
  if (leagueIds.length === 0) {
    return { weekStart: null, weeklyTop10: [], seasonTop10: [], hubLeaderboardsAvailable: true };
  }

  const leagueChunks = chunkIds(leagueIds, LEAGUE_ID_CHUNK);
  const weeklyWeekStart = getCurrentWeekStartMondayPst();

  const [weeklyTotalsSnap, seasonTotalsSnap] = await Promise.all([
    maxPointsByUserForWeekFromSnapshots(admin, leagueChunks, weeklyWeekStart),
    maxSeasonPointsByUserFromSnapshots(admin, leagueChunks),
  ]);

  let seasonTotals = seasonTotalsSnap;
  let weeklyTotals = weeklyTotalsSnap;

  if (seasonTotals.size === 0) {
    seasonTotals = await aggregateLiveSeasonByUser(admin, leagueIds);
  }

  if (mapToTop10Positive(weeklyTotals).length === 0) {
    weeklyTotals = await aggregateLiveWeeklyByUser(admin, leagueIds, weeklyWeekStart);
  }

  const weeklyTop = mapToTop10Positive(weeklyTotals);
  const seasonTop = mapToTop10(seasonTotals);

  const labelIds = [...weeklyTop.map((r) => r.userId), ...seasonTop.map((r) => r.userId)];
  const labels = await loadDisplayLabels(admin, labelIds);

  return {
    weekStart: weeklyWeekStart,
    weeklyTop10: toDisplayRows(weeklyTop, labels),
    seasonTop10: toDisplayRows(seasonTop, labels),
    hubLeaderboardsAvailable: true,
  };
}
