import "server-only";

import { unstable_cache } from "next/cache";
import { getPointsByOwnerForLeagueWeekFromMatchups } from "@/lib/leagueMatchups";
import { getCurrentWeekStartMondayPst } from "@/lib/weeklyLeaderboards";
import { getAdminClient } from "@/lib/supabase/admin";

export type SiteActivityPulse = {
  weeklyPointsScored: number;
  activeLeagues: number;
  seasonMatchesScored: number;
  seasonTradesProposed: number;
  seasonFreeAgentsSigned: number;
  /** Fantasy league champions recorded in league_season_placements (placement 1). */
  draftasticChampions: number;
};

export const SITE_ACTIVITY_PULSE_ITEMS: Array<{ key: keyof SiteActivityPulse; label: string }> = [
  { key: "weeklyPointsScored", label: "points scored this week" },
  { key: "activeLeagues", label: "active leagues" },
  { key: "seasonMatchesScored", label: "matches scored this season" },
  { key: "seasonTradesProposed", label: "season trades proposed" },
  { key: "seasonFreeAgentsSigned", label: "season free agents signed" },
  { key: "draftasticChampions", label: "Draftastic Champions" },
];

const EMPTY_PULSE: SiteActivityPulse = {
  weeklyPointsScored: 0,
  activeLeagues: 0,
  seasonMatchesScored: 0,
  seasonTradesProposed: 0,
  seasonFreeAgentsSigned: 0,
  draftasticChampions: 0,
};

function weekDateRangePst(weekStartMonday: string): { start: string; end: string } {
  const start = new Date(`${weekStartMonday}T00:00:00-07:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { start: fmt(start), end: fmt(end) };
}

/** Matches that contribute fantasy points on a completed event (mirrors scoreEvent skips). */
function isScoredMatchOnCompletedEvent(match: unknown): boolean {
  if (!match || typeof match !== "object") return false;
  const m = match as {
    matchType?: string | null;
    stipulation?: string | null;
    participants?: unknown;
    result?: unknown;
    status?: string | null;
  };

  const isPromo =
    (m.matchType && String(m.matchType).toLowerCase() === "promo") ||
    (m.stipulation && String(m.stipulation).toLowerCase() === "promo");
  if (isPromo) return false;

  if (!m.participants && !m.result) return false;

  const rowStatus =
    m.status != null && String(m.status).trim() !== ""
      ? String(m.status).trim().toLowerCase()
      : "";
  // Completed events: legacy rows often omit status; explicit non-completed rows are not scored.
  if (rowStatus && rowStatus !== "completed") return false;

  return true;
}

function countScoredMatchesInEvents(events: Array<{ matches?: unknown }>): number {
  let total = 0;
  for (const event of events) {
    const matches = event.matches;
    if (!Array.isArray(matches)) continue;
    for (const match of matches) {
      if (isScoredMatchOnCompletedEvent(match)) total += 1;
    }
  }
  return total;
}

function normalizeSiteActivityPulse(raw: Partial<SiteActivityPulse> & Record<string, unknown>): SiteActivityPulse {
  return {
    weeklyPointsScored: Number(raw.weeklyPointsScored ?? 0),
    activeLeagues: Number(raw.activeLeagues ?? 0),
    seasonMatchesScored: Number(raw.seasonMatchesScored ?? raw.matchesScoredThisWeek ?? 0),
    seasonTradesProposed: Number(raw.seasonTradesProposed ?? raw.tradesCompletedThisWeek ?? 0),
    seasonFreeAgentsSigned: Number(raw.seasonFreeAgentsSigned ?? raw.freeAgentsSignedThisWeek ?? 0),
    draftasticChampions: Number(
      raw.draftasticChampions ?? raw.newChampionsCrowned ?? 0
    ),
  };
}

async function computeSiteActivityPulse(): Promise<SiteActivityPulse> {
  const admin = getAdminClient();
  if (!admin) return { ...EMPTY_PULSE };

  const weekStart = getCurrentWeekStartMondayPst();
  const { start: weekStartDate, end: weekEndDate } = weekDateRangePst(weekStart);

  const { data: leagueRows } = await admin
    .from("leagues")
    .select("id, start_date, end_date")
    .eq("is_archived", false)
    .eq("draft_status", "completed");
  const leagueIds = (leagueRows ?? []).map((r) => (r as { id: string }).id);

  let seasonStartDate: string | null = null;
  let seasonEndDate: string | null = null;
  for (const row of leagueRows ?? []) {
    const r = row as { start_date?: string | null; end_date?: string | null };
    const start = r.start_date?.trim().slice(0, 10);
    const end = r.end_date?.trim().slice(0, 10);
    if (start && /^\d{4}-\d{2}-\d{2}$/.test(start)) {
      if (!seasonStartDate || start < seasonStartDate) seasonStartDate = start;
    }
    if (end && /^\d{4}-\d{2}-\d{2}$/.test(end)) {
      if (!seasonEndDate || end > seasonEndDate) seasonEndDate = end;
    }
  }

  let weeklyPointsScored = 0;
  for (const leagueId of leagueIds) {
    const byOwner = await getPointsByOwnerForLeagueWeekFromMatchups(leagueId, weekStart, admin);
    for (const pts of Object.values(byOwner)) {
      weeklyPointsScored += Number(pts ?? 0);
    }
  }
  weeklyPointsScored = Math.round(weeklyPointsScored);

  const [seasonEventsRes, championsRes, tradesRes, faRes] = await Promise.all([
    (() => {
      let q = admin.from("events").select("matches").eq("status", "completed");
      if (seasonStartDate) q = q.gte("date", seasonStartDate);
      if (seasonEndDate) q = q.lte("date", seasonEndDate);
      return q;
    })(),
    admin
      .from("league_season_placements")
      .select("id", { count: "exact", head: true })
      .eq("placement", 1),
    leagueIds.length > 0
      ? admin
          .from("league_trade_proposals")
          .select("id", { count: "exact", head: true })
          .in("league_id", leagueIds)
      : Promise.resolve({ count: 0, error: null }),
    leagueIds.length > 0
      ? admin
          .from("league_activity")
          .select("id", { count: "exact", head: true })
          .eq("activity_type", "fa_add")
          .in("league_id", leagueIds)
      : Promise.resolve({ count: 0, error: null }),
  ]);

  const seasonMatchesScored = countScoredMatchesInEvents(
    (seasonEventsRes.data ?? []) as Array<{ matches?: unknown }>
  );

  return normalizeSiteActivityPulse({
    weeklyPointsScored,
    activeLeagues: leagueIds.length,
    seasonMatchesScored,
    seasonTradesProposed: tradesRes.count ?? 0,
    seasonFreeAgentsSigned: faRes.count ?? 0,
    draftasticChampions: championsRes.error ? 0 : (championsRes.count ?? 0),
  });
}

const getCachedSiteActivityPulse = unstable_cache(
  computeSiteActivityPulse,
  ["site-activity-pulse-v9"],
  { revalidate: 900 }
);

export async function getSiteActivityPulse(): Promise<SiteActivityPulse> {
  try {
    const raw = await getCachedSiteActivityPulse();
    return normalizeSiteActivityPulse(raw as Partial<SiteActivityPulse> & Record<string, unknown>);
  } catch {
    return { ...EMPTY_PULSE };
  }
}
