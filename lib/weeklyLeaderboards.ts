import "server-only";

import { getAdminClient } from "@/lib/supabase/admin";
import {
  getCurrentFantasyWeekStartForLeague,
  getWeekEndForWeekStart,
  leagueLeaderboardWeekNav,
  normalizeLeagueLeaderboardWeekStart,
} from "@/lib/fantasyWeekBounds";
import { getCivilYmdInPst } from "@/lib/pstCivilTime";
import { fantasyWeekBeltScoringUnlocked } from "@/lib/beltWeeklyHold";
import { EVENT_STATUSES_FOR_WEEK_SCHEDULE, SCORING_EVENTS_FETCH_LIMIT } from "@/lib/eventsScoring";
import {
  getMondayOfWeek,
  getPointsByOwnerForLeagueWeekFromMatchups,
  getSundayOfWeek,
} from "@/lib/leagueMatchups";
import { awardWeeklyHighScoreXp } from "@/lib/xp/seasonAwards";
import { refreshFantasyPointsTiersForUser } from "@/lib/xp/refreshFantasyPointsTiers";
import { assignCompetitionRanks } from "@/lib/leaderboardRanks";
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

/** Serializable league-home leaderboard payload (API + client). */
export type LeagueHomeLeaderboardsPayload = {
  weekStart: string | null;
  currentWeekStart: string | null;
  weeklyPrevWeekStart: string | null;
  weeklyNextWeekStart: string | null;
  weeklyTop10: LeaderboardDisplayRow[];
  seasonTop10: LeaderboardDisplayRow[];
  leagueLeaderboardsAvailable: boolean;
  leagueStartYmd: string | null;
};

/** Monday YYYY-MM-DD for the current Mon–Sun fantasy week in America/Los_Angeles. */
export function getCurrentWeekStartMondayPst(now = new Date()): string {
  const pstYmd = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return getMondayOfWeek(pstYmd);
}

/** Move a fantasy week start (Monday YYYY-MM-DD) by `deltaWeeks` (negative = earlier). */
export function shiftWeekStartMonday(weekStartMonday: string, deltaWeeks: number): string {
  const d = new Date(weekStartMonday + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + 7 * deltaWeeks);
  return d.toISOString().slice(0, 10);
}

/** Previous Mon–Sun fantasy week in America/Los_Angeles (matches weekly snapshot cron). */
export function getPreviousWeekStartMondayPst(now = new Date()): string {
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
  const ranked = assignCompetitionRanks(entries);
  return ranked.map((entry) => ({
    userId: entry.userId,
    points: entry.points,
    rank: entry.rank,
    isWeeklyHigh: maxPoints > 0 && entry.points === maxPoints,
  }));
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

    const { data: weekGateRows } = await admin
      .from("events")
      .select("date, status")
      .in("status", [...EVENT_STATUSES_FOR_WEEK_SCHEDULE])
      .gte("date", weekStart)
      .lte("date", weekEnd)
      .order("date", { ascending: true })
      .limit(SCORING_EVENTS_FETCH_LIMIT);
    if (
      !fantasyWeekBeltScoringUnlocked(
        (weekGateRows ?? []) as Array<{ date: string | null; status?: string | null }>,
        weekStart,
        weekEnd,
        leagueStart,
        leagueEnd || "2099-12-31"
      )
    ) {
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
      byOwner = await getPointsByOwnerForLeagueWeekFromMatchups(league.id, weekStart, admin);
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
  /** Draft-or-start and end dates for clamping which fantasy week to show. */
  leagueStartYmd?: string | null;
  leagueEndYmd?: string | null;
  /** Optional week key (`leaderboard_week` query); defaults to the in-progress fantasy week. */
  leaderboardWeek?: string | null;
}): Promise<LeagueHomeLeaderboardsPayload> {
  const leagueStart = String(args.leagueStartYmd ?? "").slice(0, 10);
  const leagueEnd = String(args.leagueEndYmd ?? "").slice(0, 10) || "2099-12-31";
  const emptyPayload = (): LeagueHomeLeaderboardsPayload => ({
    weekStart: null,
    currentWeekStart: null,
    weeklyPrevWeekStart: null,
    weeklyNextWeekStart: null,
    weeklyTop10: [],
    seasonTop10: [],
    leagueLeaderboardsAvailable: false,
    leagueStartYmd: leagueStart || null,
  });

  const admin = getAdminClient();
  const memberByUserId = Object.fromEntries(
    args.members.map((m) => [m.user_id, m])
  );
  /** Same totals as standings / faction scoreboard (`getPointsByOwnerForLeagueWithBonuses`). */
  const seasonTop10 = assignCompetitionRanks(
    [...args.members]
      .map((m) => ({
        userId: m.user_id,
        points: Number(args.pointsByUserId[m.user_id] ?? 0),
        label: m.team_name?.trim() || m.display_name?.trim() || "Faction",
      }))
      .sort((a, b) => b.points - a.points || a.label.localeCompare(b.label))
      .slice(0, 10)
  );

  if (!admin) {
    return { ...emptyPayload(), seasonTop10 };
  }

  const now = new Date();
  const currentWeekStart =
    leagueStart && /^\d{4}-\d{2}-\d{2}$/.test(leagueStart)
      ? getCurrentFantasyWeekStartForLeague(leagueStart, leagueEnd, now)
      : getCurrentWeekStartMondayPst(now);

  const targetWeek =
    leagueStart && /^\d{4}-\d{2}-\d{2}$/.test(leagueStart)
      ? normalizeLeagueLeaderboardWeekStart(args.leaderboardWeek, leagueStart, leagueEnd, now)
      : normalizeLeagueLeaderboardWeekStart(
          args.leaderboardWeek,
          leagueStart || getCivilYmdInPst(now.getTime()),
          leagueEnd,
          now
        );

  const { weeklyPrevWeekStart, weeklyNextWeekStart } =
    leagueStart && /^\d{4}-\d{2}-\d{2}$/.test(leagueStart)
      ? leagueLeaderboardWeekNav(targetWeek, leagueStart, leagueEnd, now)
      : {
          weeklyPrevWeekStart: shiftWeekStartMonday(targetWeek, -1),
          weeklyNextWeekStart:
            shiftWeekStartMonday(targetWeek, 1) <= currentWeekStart
              ? shiftWeekStartMonday(targetWeek, 1)
              : null,
        };

  if (leagueStart && leagueEnd) {
    const we = getWeekEndForWeekStart(targetWeek, leagueStart);
    if (we < leagueStart || targetWeek > leagueEnd) {
      return { ...emptyPayload(), seasonTop10, leagueLeaderboardsAvailable: true };
    }
  }

  let byOwner: Record<string, number> = {};
  try {
    byOwner = await getPointsByOwnerForLeagueWeekFromMatchups(args.leagueId, targetWeek, admin);
  } catch {
    return { ...emptyPayload(), seasonTop10, leagueLeaderboardsAvailable: true };
  }

  const weeklyTop10 = assignCompetitionRanks(
    Object.entries(byOwner)
      .map(([userId, points]) => ({
        userId,
        points: Number(points || 0),
        label:
          memberByUserId[userId]?.team_name?.trim() ||
          memberByUserId[userId]?.display_name?.trim() ||
          "Faction",
      }))
      .filter((r) => r.points > 0)
      .sort((a, b) => b.points - a.points || a.label.localeCompare(b.label) || a.userId.localeCompare(b.userId))
      .slice(0, 10)
  );

  return {
    weekStart: targetWeek,
    currentWeekStart,
    weeklyPrevWeekStart,
    weeklyNextWeekStart,
    weeklyTop10,
    seasonTop10,
    leagueLeaderboardsAvailable: true,
    leagueStartYmd: leagueStart || null,
  };
}
