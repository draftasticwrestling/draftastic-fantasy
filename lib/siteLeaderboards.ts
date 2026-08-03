import "server-only";

import { unstable_cache } from "next/cache";
import { fromZonedTime } from "date-fns-tz";

import {
  getMondayOfWeek,
  getPointsByOwnerForLeagueWeekFromMatchups,
  getPointsByOwnerForLeagueWithBonuses,
} from "@/lib/leagueMatchups";
import { assignCompetitionRanks } from "@/lib/leaderboardRanks";
import { BELT_HOLD_TIMEZONE } from "@/lib/pstCivilTime";
import { getAdminClient } from "@/lib/supabase/admin";
import { getCurrentWeekStartMondayPst, shiftWeekStartMonday } from "@/lib/weeklyLeaderboards";
import type {
  SiteLeaderboardDisplayRow,
  SiteLeaderboardSegment,
  SiteLeaderboardSegmentId,
  SiteLeaderboardsPayload,
} from "@/lib/siteLeaderboardsTypes";
import { SITE_LEADERBOARD_SEGMENT_IDS } from "@/lib/siteLeaderboardsTypes";

type LeagueMeta = {
  id: string;
  visibility_type: string | null;
  league_type: string | null;
  include_nxt: boolean | null;
};

const SEGMENT_META: Record<
  SiteLeaderboardSegmentId,
  { title: string; description: string; match: (l: LeagueMeta) => boolean }
> = {
  public: {
    title: "Public leagues",
    description: "Best single public league (completed draft).",
    match: (l) => String(l.visibility_type ?? "").toLowerCase() === "public",
  },
  private: {
    title: "Private leagues",
    description: "Best single private league (completed draft).",
    match: (l) => String(l.visibility_type ?? "").toLowerCase() !== "public",
  },
  season_overall: {
    title: "Total Season Points",
    description: "Best single Total Season Points league.",
    match: (l) => l.league_type === "season_overall",
  },
  head_to_head: {
    title: "Head to Head",
    description: "Best single Head to Head league (includes weekly win / belt bonuses when they apply).",
    match: (l) => l.league_type === "head_to_head",
  },
  salary_cap: {
    title: "Salary Cap",
    description: "Best single Salary Cap league.",
    match: (l) => l.league_type === "salary_cap",
  },
  main_nxt: {
    title: "Main Roster + NXT",
    description: "Best single league that includes NXT in the pool and scoring.",
    match: (l) => Boolean(l.include_nxt),
  },
  main_only: {
    title: "Main Roster only",
    description: "Best single Main Roster–only league (no NXT).",
    match: (l) => !Boolean(l.include_nxt),
  },
};

function chunkIds(ids: string[], size: number): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < ids.length; i += size) out.push(ids.slice(i, i + size));
  return out;
}

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

function mapToTop10Positive(totals: Map<string, number>): { userId: string; points: number }[] {
  return [...totals.entries()]
    .map(([userId, points]) => ({ userId, points: Number(points || 0) }))
    .filter((r) => r.points > 0)
    .sort((a, b) => b.points - a.points || a.userId.localeCompare(b.userId))
    .slice(0, 10);
}

async function loadActiveCompletedLeagues(
  admin: NonNullable<ReturnType<typeof getAdminClient>>
): Promise<LeagueMeta[]> {
  const { data, error } = await admin
    .from("leagues")
    .select("id, visibility_type, league_type, include_nxt")
    .eq("is_archived", false)
    .eq("draft_status", "completed");
  if (error || !data) return [];
  return data as LeagueMeta[];
}

async function loadDisplayLabels(
  admin: NonNullable<ReturnType<typeof getAdminClient>>,
  userIds: string[]
): Promise<Map<string, string>> {
  const unique = [...new Set(userIds)].filter(Boolean);
  const labels = new Map<string, string>();
  if (unique.length === 0) return labels;

  for (const chunk of chunkIds(unique, 100)) {
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
): SiteLeaderboardDisplayRow[] {
  return assignCompetitionRanks(top).map((r) => ({
    userId: r.userId,
    points: r.points,
    rank: r.rank,
    label: labels.get(r.userId) ?? "Player",
  }));
}

const SITE_LEADERBOARD_CONCURRENCY = 4;
const SITE_LEADERBOARD_WEEK_LOOKBACK = 52;

export function normalizeSiteLeaderboardWeekStart(
  raw: string | null | undefined,
  currentMondayPst: string
): string {
  if (!raw?.trim()) return currentMondayPst;
  const m = raw.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(m)) return currentMondayPst;
  let mon = getMondayOfWeek(m);
  if (mon > currentMondayPst) mon = currentMondayPst;
  const oldest = shiftWeekStartMonday(currentMondayPst, -SITE_LEADERBOARD_WEEK_LOOKBACK);
  if (mon < oldest) mon = oldest;
  return mon;
}

function foldMaxByUser(
  leagueIds: string[],
  pointsByLeagueId: Map<string, Record<string, number>>
): Map<string, number> {
  const userMax = new Map<string, number>();
  for (const leagueId of leagueIds) {
    const byOwner = pointsByLeagueId.get(leagueId) ?? {};
    for (const [uid, pts] of Object.entries(byOwner)) {
      const p = Number(pts ?? 0);
      const prev = userMax.get(uid) ?? 0;
      if (p > prev) userMax.set(uid, p);
    }
  }
  return userMax;
}

/** Half-open UTC window [start, end) for Mon 00:00 PT → next Mon 00:00 PT. */
function pacificWeekBoundsUtcFromMonday(weekStartMonday: string): {
  startIso: string;
  endExclusiveIso: string;
} {
  const startUtc = fromZonedTime(`${weekStartMonday}T00:00:00`, BELT_HOLD_TIMEZONE);
  const nextMonday = shiftWeekStartMonday(weekStartMonday, 1);
  const endExclusiveUtc = fromZonedTime(`${nextMonday}T00:00:00`, BELT_HOLD_TIMEZONE);
  return {
    startIso: startUtc.toISOString(),
    endExclusiveIso: endExclusiveUtc.toISOString(),
  };
}

async function loadXpAllTimeTop(
  admin: NonNullable<ReturnType<typeof getAdminClient>>
): Promise<{ userId: string; points: number }[]> {
  const { data, error } = await admin
    .from("user_xp_state")
    .select("user_id, total_xp")
    .gt("total_xp", 0)
    .order("total_xp", { ascending: false })
    .limit(10);
  if (error || !data) return [];
  return (data as Array<{ user_id: string; total_xp: number | null }>).map((r) => ({
    userId: r.user_id,
    points: Math.max(0, Number(r.total_xp ?? 0)),
  }));
}

async function loadXpWeeklyTop(
  admin: NonNullable<ReturnType<typeof getAdminClient>>,
  weekStartMonday: string
): Promise<{ userId: string; points: number }[]> {
  const { startIso, endExclusiveIso } = pacificWeekBoundsUtcFromMonday(weekStartMonday);
  const totals = new Map<string, number>();
  const pageSize = 1000;
  let from = 0;
  for (;;) {
    const { data, error } = await admin
      .from("user_xp_ledger")
      .select("user_id, delta")
      .gte("created_at", startIso)
      .lt("created_at", endExclusiveIso)
      .gt("delta", 0)
      .range(from, from + pageSize - 1);
    if (error || !data?.length) break;
    for (const row of data as Array<{ user_id: string; delta: number | null }>) {
      const d = Number(row.delta ?? 0);
      if (!Number.isFinite(d) || d <= 0) continue;
      totals.set(row.user_id, (totals.get(row.user_id) ?? 0) + d);
    }
    if (data.length < pageSize) break;
    from += pageSize;
    // Safety cap: ~50k ledger rows per week is plenty for a top-10 board.
    if (from >= 50_000) break;
  }
  return mapToTop10Positive(totals);
}

function emptyPayload(available: boolean): SiteLeaderboardsPayload {
  return {
    weekStart: null,
    currentWeekStartMondayPst: null,
    weeklyPrevWeekStart: null,
    weeklyNextWeekStart: null,
    xpAllTimeTop10: [],
    xpWeeklyTop10: [],
    segments: SITE_LEADERBOARD_SEGMENT_IDS.map((id) => ({
      id,
      title: SEGMENT_META[id].title,
      description: SEGMENT_META[id].description,
      seasonTop10: [],
      weeklyTop10: [],
      leagueCount: 0,
    })),
    siteLeaderboardsAvailable: available,
  };
}

async function computeSiteLeaderboardsForWeek(selectedWeekStart: string): Promise<SiteLeaderboardsPayload> {
  const admin = getAdminClient();
  if (!admin) return emptyPayload(false);

  const currentMondayPst = getCurrentWeekStartMondayPst();
  const oldest = shiftWeekStartMonday(currentMondayPst, -SITE_LEADERBOARD_WEEK_LOOKBACK);
  const prevStart = shiftWeekStartMonday(selectedWeekStart, -1);
  const nextStart = shiftWeekStartMonday(selectedWeekStart, 1);
  const weeklyPrevWeekStart = prevStart >= oldest ? prevStart : null;
  const weeklyNextWeekStart = nextStart <= currentMondayPst ? nextStart : null;

  const [xpAllTimeRaw, xpWeeklyRaw] = await Promise.all([
    loadXpAllTimeTop(admin),
    loadXpWeeklyTop(admin, selectedWeekStart),
  ]);

  let leagues = await loadActiveCompletedLeagues(admin);
  const maxLeagues = Number.parseInt(process.env.HUB_LEADERBOARD_MAX_LEAGUES ?? "", 10);
  if (Number.isFinite(maxLeagues) && maxLeagues > 0 && leagues.length > maxLeagues) {
    leagues = leagues.slice(0, maxLeagues);
  }

  const labelUserIds: string[] = [
    ...xpAllTimeRaw.map((r) => r.userId),
    ...xpWeeklyRaw.map((r) => r.userId),
  ];

  const segments: SiteLeaderboardSegment[] = [];
  const pending: Array<{
    id: SiteLeaderboardSegmentId;
    title: string;
    description: string;
    leagueCount: number;
    seasonTop: { userId: string; points: number }[];
    weeklyTop: { userId: string; points: number }[];
  }> = [];

  if (leagues.length > 0) {
    const seasonByLeague = new Map<string, Record<string, number>>();
    const weeklyByLeague = new Map<string, Record<string, number>>();

    await mapConcurrent(leagues, SITE_LEADERBOARD_CONCURRENCY, async (league) => {
      const [season, weekly] = await Promise.all([
        getPointsByOwnerForLeagueWithBonuses(league.id, admin),
        getPointsByOwnerForLeagueWeekFromMatchups(league.id, selectedWeekStart, admin),
      ]);
      seasonByLeague.set(league.id, season);
      weeklyByLeague.set(league.id, weekly);
    });

    for (const id of SITE_LEADERBOARD_SEGMENT_IDS) {
      const meta = SEGMENT_META[id];
      const matched = leagues.filter(meta.match);
      const matchedIds = matched.map((l) => l.id);
      const seasonTotals = foldMaxByUser(matchedIds, seasonByLeague);
      const weeklyTotals = foldMaxByUser(matchedIds, weeklyByLeague);
      const seasonTop = mapToTop10(seasonTotals);
      const weeklyTop = mapToTop10Positive(weeklyTotals);
      for (const r of [...seasonTop, ...weeklyTop]) labelUserIds.push(r.userId);
      pending.push({
        id,
        title: meta.title,
        description: meta.description,
        leagueCount: matchedIds.length,
        seasonTop,
        weeklyTop,
      });
    }
  } else {
    for (const id of SITE_LEADERBOARD_SEGMENT_IDS) {
      const meta = SEGMENT_META[id];
      pending.push({
        id,
        title: meta.title,
        description: meta.description,
        leagueCount: 0,
        seasonTop: [],
        weeklyTop: [],
      });
    }
  }

  const labels = await loadDisplayLabels(admin, labelUserIds);
  for (const seg of pending) {
    segments.push({
      id: seg.id,
      title: seg.title,
      description: seg.description,
      leagueCount: seg.leagueCount,
      seasonTop10: toDisplayRows(seg.seasonTop, labels),
      weeklyTop10: toDisplayRows(seg.weeklyTop, labels),
    });
  }

  return {
    weekStart: selectedWeekStart,
    currentWeekStartMondayPst: currentMondayPst,
    weeklyPrevWeekStart,
    weeklyNextWeekStart,
    xpAllTimeTop10: toDisplayRows(xpAllTimeRaw, labels),
    xpWeeklyTop10: toDisplayRows(xpWeeklyRaw, labels),
    segments,
    siteLeaderboardsAvailable: true,
  };
}

const getSiteLeaderboardsCached = unstable_cache(
  async (selectedWeekStart: string) => computeSiteLeaderboardsForWeek(selectedWeekStart),
  ["site-leaderboards-by-week-v3"],
  { revalidate: 180 }
);

export async function getSiteLeaderboards(opts?: {
  leaderboardWeek?: string | null;
}): Promise<SiteLeaderboardsPayload> {
  const admin = getAdminClient();
  if (!admin) return emptyPayload(false);

  const currentMondayPst = getCurrentWeekStartMondayPst();
  const selectedWeekStart = normalizeSiteLeaderboardWeekStart(opts?.leaderboardWeek ?? null, currentMondayPst);
  return getSiteLeaderboardsCached(selectedWeekStart);
}
