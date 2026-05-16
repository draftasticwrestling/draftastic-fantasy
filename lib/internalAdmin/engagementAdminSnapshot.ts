import "server-only";

import { unstable_cache } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getServiceRoleClient } from "@/lib/internalAdmin/serviceClient";
import {
  ENGAGEMENT_PERIOD_KEYS,
  type EngagementPeriodKey,
  engagementPeriodBounds,
  type SeasonCalendarRange,
} from "@/lib/internalAdmin/engagementPeriods";
import {
  type DailyEngagementTrendRow,
  type EngagementKpiCounts,
  engagementDistinctUserCount,
  fetchDailyEngagementTrend,
  fetchEngagementKpiCounts,
  fetchSeasonCalendarRange,
  paginateContentEngagementRows,
  paginateSeasonEngagementRows,
} from "@/lib/internalAdmin/engagementStats";

/** Cached admin engagement bundle; stale up to this many seconds is acceptable. */
export const ENGAGEMENT_ADMIN_CACHE_SECONDS = 3600;

export type EngagementPeriodSnapshot = {
  kpis: EngagementKpiCounts;
  /** Distinct users with any season-scoped engagement event in the window. */
  activeUsers: number;
  signInUniqueUsers: number;
  articleViewUniqueUsers: number;
  resultsViewUniqueUsers: number;
};

export type EngagementAdminSnapshot = {
  seasonSlug: string;
  computedAt: string;
  cacheTtlSeconds: number;
  seasonCalendar: SeasonCalendarRange;
  periods: Record<EngagementPeriodKey, EngagementPeriodSnapshot>;
  dailyTrend: DailyEngagementTrendRow[];
};

async function buildPeriodSnapshot(
  admin: SupabaseClient,
  seasonSlug: string,
  period: EngagementPeriodKey,
  seasonCalendar: SeasonCalendarRange,
  now: Date
): Promise<EngagementPeriodSnapshot> {
  const bounds = engagementPeriodBounds(period, seasonCalendar, now);
  const countOpts = {
    startInclusiveIso: bounds.startInclusiveIso,
    endExclusiveIso: bounds.endExclusiveIso,
  };

  const [kpis, activeUsers, signInUniqueUsers, articleViewUniqueUsers, resultsViewUniqueUsers] =
    await Promise.all([
      fetchEngagementKpiCounts(admin, seasonSlug, bounds),
      engagementDistinctUserCount(admin, {
        seasonSlug,
        seasonScoped: true,
        ...countOpts,
      }),
      engagementDistinctUserCount(admin, {
        seasonSlug,
        seasonScoped: true,
        eventName: "auth.sign_in",
        ...countOpts,
      }),
      engagementDistinctUserCount(admin, {
        seasonSlug,
        seasonScoped: false,
        eventName: "page.news_article_view",
        ...countOpts,
      }),
      engagementDistinctUserCount(admin, {
        seasonSlug,
        seasonScoped: false,
        eventName: "page.event_results_view",
        ...countOpts,
      }),
    ]);

  return {
    kpis,
    activeUsers,
    signInUniqueUsers,
    articleViewUniqueUsers,
    resultsViewUniqueUsers,
  };
}

export async function computeEngagementAdminSnapshot(
  admin: SupabaseClient,
  seasonSlug: string
): Promise<EngagementAdminSnapshot> {
  const now = new Date();
  const seasonCalendar = await fetchSeasonCalendarRange(admin, seasonSlug);

  const periods = {} as Record<EngagementPeriodKey, EngagementPeriodSnapshot>;
  for (const period of ENGAGEMENT_PERIOD_KEYS) {
    periods[period] = await buildPeriodSnapshot(admin, seasonSlug, period, seasonCalendar, now);
  }

  const dailyTrend = await fetchDailyEngagementTrend(admin, seasonSlug, 21);

  return {
    seasonSlug,
    computedAt: now.toISOString(),
    cacheTtlSeconds: ENGAGEMENT_ADMIN_CACHE_SECONDS,
    seasonCalendar,
    periods,
    dailyTrend,
  };
}

const loadEngagementAdminSnapshot = unstable_cache(
  async (seasonSlug: string): Promise<EngagementAdminSnapshot | null> => {
    const admin = getServiceRoleClient();
    if (!admin) return null;
    return computeEngagementAdminSnapshot(admin, seasonSlug);
  },
  ["engagement-admin-snapshot-v2"],
  { revalidate: ENGAGEMENT_ADMIN_CACHE_SECONDS, tags: ["engagement-admin"] }
);

export async function getEngagementAdminSnapshot(
  seasonSlug: string
): Promise<EngagementAdminSnapshot | null> {
  if (!seasonSlug.trim()) return null;
  return loadEngagementAdminSnapshot(seasonSlug);
}

const USER_TABLE_LOOKBACK_DAYS = 120;

const loadEngagementUserTableRows = unstable_cache(
  async (seasonSlug: string) => {
    const admin = getServiceRoleClient();
    if (!admin) return { seasonRows: [], contentRows: [] };
    const sinceIso = new Date(
      Date.now() - USER_TABLE_LOOKBACK_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();
    const [seasonRows, contentRows] = await Promise.all([
      paginateSeasonEngagementRows(admin, seasonSlug, sinceIso),
      paginateContentEngagementRows(admin, sinceIso),
    ]);
    return { seasonRows, contentRows, sinceIso, lookbackDays: USER_TABLE_LOOKBACK_DAYS };
  },
  ["engagement-admin-user-rows-v1"],
  { revalidate: ENGAGEMENT_ADMIN_CACHE_SECONDS, tags: ["engagement-admin"] }
);

export async function getEngagementAdminUserTableRows(seasonSlug: string) {
  if (!seasonSlug.trim()) {
    return { seasonRows: [], contentRows: [], sinceIso: "", lookbackDays: USER_TABLE_LOOKBACK_DAYS };
  }
  return loadEngagementUserTableRows(seasonSlug);
}
