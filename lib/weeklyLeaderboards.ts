import "server-only";

import { getAdminClient } from "@/lib/supabase/admin";
import { getMondayOfWeek, getPointsByOwnerForLeagueForWeek, getSundayOfWeek } from "@/lib/leagueMatchups";
import { awardWeeklyHighScoreXp } from "@/lib/xp/seasonAwards";
import { refreshFantasyPointsTiersForUser } from "@/lib/xp/refreshFantasyPointsTiers";
import type { LeagueMember } from "@/lib/leagues";

export type WeeklyLeaderboardRow = {
  userId: string;
  points: number;
  rank: number;
  isWeeklyHigh: boolean;
};

export type LeaderboardDisplayRow = {
  userId: string;
  points: number;
  rank: number;
  label: string;
};

function getPreviousWeekStartMondayPst(now = new Date()): string {
  const pstYmd = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const currentWeekMonday = getMondayOfWeek(pstYmd);
  const d = new Date(`${currentWeekMonday}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 7);
  return d.toISOString().slice(0, 10);
}

function toRankedRows(pointsByUserId: Record<string, number>): WeeklyLeaderboardRow[] {
  const entries = Object.entries(pointsByUserId)
    .map(([userId, pts]) => ({ userId, points: Number(pts || 0) }))
    .sort((a, b) => b.points - a.points || a.userId.localeCompare(b.userId));
  if (entries.length === 0) return [];

  const maxPoints = entries[0]!.points;
  let currentRank = 0;
  let previousPoints: number | null = null;
  return entries.map((entry, idx) => {
    if (previousPoints === null || entry.points !== previousPoints) {
      currentRank = idx + 1;
      previousPoints = entry.points;
    }
    return {
      userId: entry.userId,
      points: entry.points,
      rank: currentRank,
      isWeeklyHigh: maxPoints > 0 && entry.points === maxPoints,
    };
  });
}

export async function processWeeklyXpAndLeaderboards(
  targetWeekStartMonday?: string,
  opts?: { reprocess?: boolean }
): Promise<{
  weekStart: string;
  weekEnd: string;
  processedLeagues: number;
  skippedLeagues: number;
  skippedSnapshotAlreadyComplete: number;
  awardsGranted: number;
  xpUsersRefreshed: number;
  errors: string[];
}> {
  const admin = getAdminClient();
  if (!admin) {
    const ws = targetWeekStartMonday ?? getPreviousWeekStartMondayPst();
    return {
      weekStart: ws,
      weekEnd: getSundayOfWeek(ws),
      processedLeagues: 0,
      skippedLeagues: 0,
      skippedSnapshotAlreadyComplete: 0,
      awardsGranted: 0,
      xpUsersRefreshed: 0,
      errors: ["SUPABASE_SERVICE_ROLE_KEY not configured"],
    };
  }

  const reprocess = Boolean(opts?.reprocess);
  const weekStart = targetWeekStartMonday ?? getPreviousWeekStartMondayPst();
  const weekEnd = getSundayOfWeek(weekStart);
  const errors: string[] = [];
  let processedLeagues = 0;
  let skippedLeagues = 0;
  let skippedSnapshotAlreadyComplete = 0;
  let awardsGranted = 0;
  const usersToRefresh = new Set<string>();

  const { data: leagues, error: leaguesErr } = await admin
    .from("leagues")
    .select("id, start_date, draft_date, end_date, is_archived, draft_status")
    .eq("is_archived", false)
    .eq("draft_status", "completed");
  if (leaguesErr) {
    return {
      weekStart,
      weekEnd,
      processedLeagues: 0,
      skippedLeagues: 0,
      skippedSnapshotAlreadyComplete: 0,
      awardsGranted: 0,
      xpUsersRefreshed: 0,
      errors: [leaguesErr.message],
    };
  }

  for (const l of leagues ?? []) {
    const league = l as {
      id: string;
      start_date?: string | null;
      draft_date?: string | null;
      end_date?: string | null;
    };
    const leagueStart = String((league.draft_date || league.start_date || "")).slice(0, 10);
    const leagueEnd = String(league.end_date || "").slice(0, 10);
    if (!leagueStart || weekEnd < leagueStart || (leagueEnd && weekStart > leagueEnd)) {
      skippedLeagues += 1;
      continue;
    }

    const { count: liveCount } = await admin
      .from("events")
      .select("*", { count: "exact", head: true })
      .eq("status", "live")
      .gte("date", weekStart)
      .lte("date", weekEnd);
    if ((liveCount ?? 0) > 0) {
      skippedLeagues += 1;
      continue;
    }

    const { data: membersData, error: membersErr } = await admin
      .from("league_members")
      .select("user_id")
      .eq("league_id", league.id);
    if (membersErr) {
      errors.push(`league ${league.id}: ${membersErr.message}`);
      continue;
    }
    const memberUserIds = (membersData ?? []).map((m) => String((m as { user_id: string }).user_id));
    if (memberUserIds.length === 0) {
      skippedLeagues += 1;
      continue;
    }

    if (!reprocess) {
      const { count: snapCount } = await admin
        .from("league_weekly_points_snapshot")
        .select("*", { count: "exact", head: true })
        .eq("league_id", league.id)
        .eq("week_start", weekStart);
      if ((snapCount ?? 0) >= memberUserIds.length) {
        skippedSnapshotAlreadyComplete += 1;
        continue;
      }
    }

    let byOwner: Record<string, number> = {};
    try {
      byOwner = await getPointsByOwnerForLeagueForWeek(league.id, weekStart, admin);
    } catch (err) {
      errors.push(`league ${league.id}: weekly points failed (${err instanceof Error ? err.message : "unknown"})`);
      continue;
    }

    for (const uid of memberUserIds) {
      if (byOwner[uid] == null) byOwner[uid] = 0;
    }
    const rankedRows = toRankedRows(byOwner);

    const upsertRows = rankedRows.map((r) => ({
      league_id: league.id,
      week_start: weekStart,
      user_id: r.userId,
      points: r.points,
      rank: r.rank,
      is_weekly_high: r.isWeeklyHigh,
      updated_at: new Date().toISOString(),
    }));
    const { error: upsertErr } = await admin
      .from("league_weekly_points_snapshot")
      .upsert(upsertRows, { onConflict: "league_id,week_start,user_id" });
    if (upsertErr) {
      errors.push(`league ${league.id}: snapshot upsert failed (${upsertErr.message})`);
      continue;
    }

    const topScore = rankedRows.length > 0 ? rankedRows[0]!.points : 0;
    if (topScore > 0) {
      for (const winner of rankedRows.filter((r) => r.isWeeklyHigh && r.points > 0)) {
        try {
          await awardWeeklyHighScoreXp({
            userId: winner.userId,
            leagueId: league.id,
            weekKey: weekStart,
          });
          awardsGranted += 1;
        } catch {
          errors.push(`league ${league.id}: weekly XP failed for ${winner.userId}`);
        }
      }
    }

    for (const uid of memberUserIds) usersToRefresh.add(uid);
    processedLeagues += 1;
  }

  let xpUsersRefreshed = 0;
  for (const uid of usersToRefresh) {
    try {
      await refreshFantasyPointsTiersForUser(uid, { force: true });
      xpUsersRefreshed += 1;
    } catch {
      errors.push(`refreshFantasyPointsTiersForUser failed for ${uid}`);
    }
  }

  return {
    weekStart,
    weekEnd,
    processedLeagues,
    skippedLeagues,
    skippedSnapshotAlreadyComplete,
    awardsGranted,
    xpUsersRefreshed,
    errors,
  };
}

export async function getLeagueHomeLeaderboards(args: {
  leagueId: string;
  members: LeagueMember[];
  pointsByUserId: Record<string, number>;
}): Promise<{
  weekStart: string | null;
  weeklyTop10: LeaderboardDisplayRow[];
  seasonTop10: LeaderboardDisplayRow[];
}> {
  const admin = getAdminClient();
  const memberByUserId = Object.fromEntries(
    args.members.map((m) => [m.user_id, m])
  );
  const fallbackSeason = [...args.members]
    .map((m) => ({
      userId: m.user_id,
      points: Number(args.pointsByUserId[m.user_id] ?? 0),
      label: m.team_name?.trim() || m.display_name?.trim() || "Faction",
    }))
    .sort((a, b) => b.points - a.points || a.label.localeCompare(b.label))
    .slice(0, 10)
    .map((r, idx) => ({ ...r, rank: idx + 1 }));

  if (!admin) {
    return { weekStart: null, weeklyTop10: [], seasonTop10: fallbackSeason };
  }

  const { data, error } = await admin
    .from("league_weekly_points_snapshot")
    .select("week_start, user_id, points, rank")
    .eq("league_id", args.leagueId)
    .order("week_start", { ascending: false });
  if (error || !data || data.length === 0) {
    return { weekStart: null, weeklyTop10: [], seasonTop10: fallbackSeason };
  }

  const rows = data as Array<{
    week_start: string;
    user_id: string;
    points: number;
    rank: number;
  }>;
  const latestWeek = rows[0]!.week_start;
  const weeklyTop10 = rows
    .filter((r) => r.week_start === latestWeek)
    .sort((a, b) => b.points - a.points || a.user_id.localeCompare(b.user_id))
    .slice(0, 10)
    .map((r, idx) => ({
      userId: r.user_id,
      points: Number(r.points || 0),
      rank: idx + 1,
      label:
        memberByUserId[r.user_id]?.team_name?.trim() ||
        memberByUserId[r.user_id]?.display_name?.trim() ||
        "Faction",
    }));

  const seasonTotals = new Map<string, number>();
  for (const r of rows) {
    seasonTotals.set(r.user_id, (seasonTotals.get(r.user_id) ?? 0) + Number(r.points || 0));
  }
  const seasonTop10 = [...seasonTotals.entries()]
    .map(([userId, points]) => ({
      userId,
      points,
      label:
        memberByUserId[userId]?.team_name?.trim() ||
        memberByUserId[userId]?.display_name?.trim() ||
        "Faction",
    }))
    .sort((a, b) => b.points - a.points || a.label.localeCompare(b.label))
    .slice(0, 10)
    .map((r, idx) => ({ ...r, rank: idx + 1 }));

  return { weekStart: latestWeek, weeklyTop10, seasonTop10 };
}
