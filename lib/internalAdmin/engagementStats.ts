import type { SupabaseClient } from "@supabase/supabase-js";

export type EngagementRow = {
  event_name: string;
  user_id: string | null;
  occurred_at: string;
  path: string | null;
};

/** Next calendar day in UTC (YYYY-MM-DD) after `ymd`. */
export function utcNextCalendarDayYmd(ymd: string): string {
  const d = new Date(ymd + "T12:00:00.000Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** UTC calendar days newest-first: today = index 0, … `count - 1` days ago. */
export function lastUtcCalendarDays(count: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

type CountOpts = {
  eventName: string;
  /** When set, `eq("season_slug", value)`. When `null`, `is("season_slug", null)`. When omitted, no season filter. */
  seasonSlug?: string | null;
  startInclusiveIso?: string;
  endExclusiveIso?: string;
};

/**
 * Exact row count (PostgREST `count: exact`, `head: true`). Uses primary key for minimal payload.
 */
export async function engagementEventCount(
  admin: SupabaseClient,
  opts: CountOpts
): Promise<number> {
  let q = admin.from("engagement_events").select("id", { count: "exact", head: true }).eq("event_name", opts.eventName);
  if (opts.seasonSlug === null) q = q.is("season_slug", null);
  else if (typeof opts.seasonSlug === "string" && opts.seasonSlug.length > 0) {
    q = q.eq("season_slug", opts.seasonSlug);
  }
  if (opts.startInclusiveIso) q = q.gte("occurred_at", opts.startInclusiveIso);
  if (opts.endExclusiveIso) q = q.lt("occurred_at", opts.endExclusiveIso);
  const { count, error } = await q;
  if (error) return 0;
  return typeof count === "number" ? count : 0;
}

export type DailyEngagementTrendRow = {
  day: string;
  signIns: number;
  faAdds: number;
  drops: number;
  tradesExecuted: number;
  loggedInViews: number;
  articleViews: number;
  resultsViews: number;
};

/**
 * Per-day counts for the admin “Daily trend” table. Uses indexed count queries (not a 50k row cap),
 * so sign-ins / roster actions do not disappear when `page.logged_in_view` volume is high.
 */
export async function fetchDailyEngagementTrend(
  admin: SupabaseClient,
  seasonSlug: string,
  dayCount = 21
): Promise<DailyEngagementTrendRow[]> {
  const days = lastUtcCalendarDays(dayCount);
  return Promise.all(
    days.map(async (day) => {
      const startInclusiveIso = `${day}T00:00:00.000Z`;
      const endExclusiveIso = `${utcNextCalendarDayYmd(day)}T00:00:00.000Z`;
      const [
        signIns,
        faAdds,
        drops,
        tradesExecuted,
        loggedInViews,
        articleViews,
        resultsViews,
      ] = await Promise.all([
        engagementEventCount(admin, {
          eventName: "auth.sign_in",
          seasonSlug,
          startInclusiveIso,
          endExclusiveIso,
        }),
        engagementEventCount(admin, {
          eventName: "league.fa_add",
          seasonSlug,
          startInclusiveIso,
          endExclusiveIso,
        }),
        engagementEventCount(admin, {
          eventName: "league.drop",
          seasonSlug,
          startInclusiveIso,
          endExclusiveIso,
        }),
        engagementEventCount(admin, {
          eventName: "league.trade_executed",
          seasonSlug,
          startInclusiveIso,
          endExclusiveIso,
        }),
        engagementEventCount(admin, {
          eventName: "page.logged_in_view",
          seasonSlug,
          startInclusiveIso,
          endExclusiveIso,
        }),
        engagementEventCount(admin, {
          eventName: "page.news_article_view",
          seasonSlug: null,
          startInclusiveIso,
          endExclusiveIso,
        }),
        engagementEventCount(admin, {
          eventName: "page.event_results_view",
          seasonSlug: null,
          startInclusiveIso,
          endExclusiveIso,
        }),
      ]);
      return {
        day,
        signIns,
        faAdds,
        drops,
        tradesExecuted,
        loggedInViews,
        articleViews,
        resultsViews,
      };
    })
  );
}

/** KPI totals for a season (no date cap). */
export async function fetchSeasonEngagementKpiCounts(
  admin: SupabaseClient,
  seasonSlug: string
): Promise<{
  signIns: number;
  faAdds: number;
  drops: number;
  tradesProposed: number;
  tradesExecuted: number;
  myFactionViews: number;
  freeAgentsViews: number;
  leadersViews: number;
  loggedInViews: number;
  sessionStarts: number;
  articleViews: number;
  resultsViews: number;
}> {
  const [
    signIns,
    faAdds,
    drops,
    tradesProposed,
    tradesExecuted,
    myFactionViews,
    freeAgentsViews,
    leadersViews,
    loggedInViews,
    sessionStarts,
    articleViews,
    resultsViews,
  ] = await Promise.all([
    engagementEventCount(admin, { eventName: "auth.sign_in", seasonSlug }),
    engagementEventCount(admin, { eventName: "league.fa_add", seasonSlug }),
    engagementEventCount(admin, { eventName: "league.drop", seasonSlug }),
    engagementEventCount(admin, { eventName: "league.trade_proposed", seasonSlug }),
    engagementEventCount(admin, { eventName: "league.trade_executed", seasonSlug }),
    engagementEventCount(admin, { eventName: "page.my_faction_view", seasonSlug }),
    engagementEventCount(admin, { eventName: "page.free_agents_view", seasonSlug }),
    engagementEventCount(admin, { eventName: "page.league_leaders_view", seasonSlug }),
    engagementEventCount(admin, { eventName: "page.logged_in_view", seasonSlug }),
    engagementEventCount(admin, { eventName: "session.logged_in_start", seasonSlug }),
    engagementEventCount(admin, { eventName: "page.news_article_view", seasonSlug: null }),
    engagementEventCount(admin, { eventName: "page.event_results_view", seasonSlug: null }),
  ]);
  return {
    signIns,
    faAdds,
    drops,
    tradesProposed,
    tradesExecuted,
    myFactionViews,
    freeAgentsViews,
    leadersViews,
    loggedInViews,
    sessionStarts,
    articleViews,
    resultsViews,
  };
}

/**
 * Paginate season engagement rows for the per-user table (avoids the 50k “recent only” bias).
 * Caps total rows to protect admin page latency.
 */
export async function paginateSeasonEngagementRows(
  admin: SupabaseClient,
  seasonSlug: string,
  sinceIso: string,
  opts?: { pageSize?: number; maxRows?: number }
): Promise<EngagementRow[]> {
  const pageSize = opts?.pageSize ?? 4000;
  const maxRows = opts?.maxRows ?? 250_000;
  const out: EngagementRow[] = [];
  for (let from = 0; from < maxRows; from += pageSize) {
    const to = from + pageSize - 1;
    const { data, error } = await admin
      .from("engagement_events")
      .select("event_name, user_id, occurred_at, path")
      .eq("season_slug", seasonSlug)
      .gte("occurred_at", sinceIso)
      .order("occurred_at", { ascending: true })
      .range(from, to);
    if (error || !data?.length) break;
    out.push(...(data as EngagementRow[]));
    if (data.length < pageSize) break;
  }
  return out;
}

/**
 * Distinct `user_id` values for an event (non-null users only), by scanning rows in `occurred_at` order.
 * Used for “unique users” KPIs without SQL `count(distinct)`.
 */
export async function distinctUserIdsForEngagementEvent(
  admin: SupabaseClient,
  opts: {
    eventName: string;
    seasonSlug?: string | null;
    /** When set, only rows with `occurred_at >= sinceIso`. */
    sinceIso?: string;
    maxScanRows?: number;
  }
): Promise<Set<string>> {
  const pageSize = 6000;
  const maxScan = opts.maxScanRows ?? 600_000;
  const seen = new Set<string>();
  for (let from = 0; from < maxScan; from += pageSize) {
    const to = from + pageSize - 1;
    let q = admin
      .from("engagement_events")
      .select("user_id")
      .eq("event_name", opts.eventName)
      .not("user_id", "is", null)
      .order("occurred_at", { ascending: true })
      .range(from, to);
    if (opts.seasonSlug === null) q = q.is("season_slug", null);
    else if (typeof opts.seasonSlug === "string" && opts.seasonSlug.length > 0) {
      q = q.eq("season_slug", opts.seasonSlug);
    }
    if (opts.sinceIso) q = q.gte("occurred_at", opts.sinceIso);
    const { data, error } = await q;
    if (error || !data?.length) break;
    for (const r of data as { user_id?: string | null }[]) {
      const id = r.user_id;
      if (id) seen.add(id);
    }
    if (data.length < pageSize) break;
  }
  return seen;
}

export async function paginateContentEngagementRows(
  admin: SupabaseClient,
  sinceIso: string,
  opts?: { pageSize?: number; maxRows?: number }
): Promise<EngagementRow[]> {
  const pageSize = opts?.pageSize ?? 4000;
  const maxRows = opts?.maxRows ?? 120_000;
  const out: EngagementRow[] = [];
  for (let from = 0; from < maxRows; from += pageSize) {
    const to = from + pageSize - 1;
    const { data, error } = await admin
      .from("engagement_events")
      .select("event_name, user_id, occurred_at, path")
      .is("season_slug", null)
      .in("event_name", ["page.news_article_view", "page.event_results_view"])
      .gte("occurred_at", sinceIso)
      .order("occurred_at", { ascending: true })
      .range(from, to);
    if (error || !data?.length) break;
    out.push(...(data as EngagementRow[]));
    if (data.length < pageSize) break;
  }
  return out;
}
