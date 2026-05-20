import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getEventShowType, type EventShowFilter } from "@/lib/boxscore/eventShowHeader";
import {
  EVENT_RESULTS_PAGE_SELECT,
  type EventResultsPageRow,
  parseEventResultsSlugParam,
  buildEventResultsSlug,
  normalizeEventDateForUrl,
} from "@/lib/event-results/eventResultsRoute";
import { escapeIlikePattern } from "@/lib/internalAdmin/escapeIlike";
import {
  buildAdminEventStatusOrFilter,
  eventMatchesAdminStatusFilter,
} from "@/lib/internalAdmin/boxscoreEventListStatus";
import {
  parseSiteAdminEventShowFilter,
  parseSiteAdminEventStatusFilter,
  parseSiteAdminEventsLimit,
  type SiteAdminEventShowFilter,
  type SiteAdminEventStatusFilter,
  type SiteAdminEventsLimit,
} from "@/lib/internalAdmin/boxscoreEventsListParams";

export type {
  SiteAdminEventShowFilter,
  SiteAdminEventStatusFilter,
  SiteAdminEventsLimit,
} from "@/lib/internalAdmin/boxscoreEventsListParams";

export type SiteAdminSearchEventsOpts = {
  q?: string;
  date?: string;
  id?: string;
  status?: SiteAdminEventStatusFilter | string;
  show?: SiteAdminEventShowFilter | string;
  limit?: SiteAdminEventsLimit | number | string;
};

export type SiteAdminSearchEventsResult = {
  rows: EventResultsPageRow[];
  error?: string;
  /** Rows returned from DB before show-type post-filter slice. */
  fetchedCount: number;
  /** True when the query hit the fetch cap — more rows may exist. */
  hasMore: boolean;
  limit: SiteAdminEventsLimit;
  status: SiteAdminEventStatusFilter;
  show: SiteAdminEventShowFilter;
};

function pickResolvedEvent(candidates: EventResultsPageRow[], decodedParam: string): EventResultsPageRow | null {
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];
  const exact = candidates.find((e) => buildEventResultsSlug(e) === decodedParam);
  if (exact) return exact;
  return [...candidates].sort((a, b) => a.id.localeCompare(b.id))[0];
}

/** Resolve an event by DB id or canonical results slug (raw|smackdown|ple-YYYY-MM-DD). */
export async function siteAdminGetEventByParam(
  admin: SupabaseClient,
  param: string
): Promise<EventResultsPageRow | null> {
  const decoded = decodeURIComponent(param.trim());

  const { data: byId } = await admin
    .from("events")
    .select(EVENT_RESULTS_PAGE_SELECT)
    .eq("id", decoded)
    .maybeSingle();

  if (byId) return byId as unknown as EventResultsPageRow;

  const parsed = parseEventResultsSlugParam(decoded);
  if (!parsed) return null;

  const { data: rows } = await admin.from("events").select(EVENT_RESULTS_PAGE_SELECT).eq("date", parsed.date);

  const candidates = (rows ?? []).filter((e) => getEventShowType(e) === parsed.show) as EventResultsPageRow[];

  return pickResolvedEvent(candidates, decoded.toLowerCase());
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyShowTypeSqlFilter(qb: any, show: EventShowFilter) {
  if (show === "raw") {
    return qb.ilike("name", "%raw%").not("name", "ilike", "%tag team%");
  }
  if (show === "smackdown") {
    return qb.or("name.ilike.%smackdown%,name.ilike.%smack down%");
  }
  if (show === "nxt") {
    return qb.or("name.ilike.NXT,name.ilike.NXT %,name.ilike.WWE NXT%,name.ilike.nxt %");
  }
  return qb;
}

function filterRowsByShow(rows: EventResultsPageRow[], show: SiteAdminEventShowFilter): EventResultsPageRow[] {
  if (show === "all") return rows;
  return rows.filter((e) => getEventShowType(e) === show);
}

/** Upcoming: soonest show first. Completed / live / all: newest first (PWBS-style). */
function sortAdminEventRowsByDate(
  rows: EventResultsPageRow[],
  status: SiteAdminEventStatusFilter
): EventResultsPageRow[] {
  const copy = [...rows];
  copy.sort((a, b) => {
    const da = normalizeEventDateForUrl(a.date) ?? "";
    const db = normalizeEventDateForUrl(b.date) ?? "";
    const cmp = da.localeCompare(db);
    if (status === "upcoming") return cmp;
    return -cmp;
  });
  return copy;
}

function adminEventsDateAscending(status: SiteAdminEventStatusFilter): boolean {
  return status === "upcoming";
}

export async function siteAdminSearchEvents(
  admin: SupabaseClient,
  opts: SiteAdminSearchEventsOpts
): Promise<SiteAdminSearchEventsResult> {
  const status = parseSiteAdminEventStatusFilter(
    typeof opts.status === "string" ? opts.status : opts.status
  );
  const show = parseSiteAdminEventShowFilter(typeof opts.show === "string" ? opts.show : opts.show ?? "all");
  const limit = parseSiteAdminEventsLimit(
    typeof opts.limit === "number" ? String(opts.limit) : opts.limit
  );

  const empty = (overrides?: Partial<SiteAdminSearchEventsResult>): SiteAdminSearchEventsResult => ({
    rows: [],
    fetchedCount: 0,
    hasMore: false,
    limit,
    status,
    show,
    ...overrides,
  });

  const id = opts.id?.trim();
  if (id) {
    const one = await siteAdminGetEventByParam(admin, id);
    const rows = one
      ? filterRowsByShow([one], show).filter((e) => eventMatchesAdminStatusFilter(e, status))
      : [];
    return { ...empty(), rows, fetchedCount: rows.length };
  }

  const date = opts.date?.trim();
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    let qb = admin
      .from("events")
      .select(EVENT_RESULTS_PAGE_SELECT)
      .eq("date", date)
      .order("name", { ascending: true })
      .limit(Math.max(limit, 80));

    const statusOr = buildAdminEventStatusOrFilter(status);
    if (statusOr) qb = qb.or(statusOr);
    if (show === "raw" || show === "smackdown" || show === "nxt") {
      qb = applyShowTypeSqlFilter(qb, show);
    }

    const { data, error } = await qb;
    if (error) return { ...empty(), error: error.message };
    const fetched = (data ?? []) as EventResultsPageRow[];
    const rows = filterRowsByShow(fetched, show)
      .filter((e) => eventMatchesAdminStatusFilter(e, status))
      .slice(0, limit);
    return {
      rows,
      fetchedCount: fetched.length,
      hasMore: fetched.length >= Math.max(limit, 80),
      limit,
      status,
      show,
    };
  }

  const q = opts.q?.trim();
  const plePostFilter = show === "ple";
  const sqlShow = show === "raw" || show === "smackdown" || show === "nxt" ? show : null;
  const fetchLimit = plePostFilter || sqlShow ? Math.min(Math.max(limit * 6, limit + 25), 600) : limit;

  let qb = admin
    .from("events")
    .select(EVENT_RESULTS_PAGE_SELECT)
    .order("date", { ascending: adminEventsDateAscending(status) })
    .limit(fetchLimit);

  const statusOr = buildAdminEventStatusOrFilter(status);
  if (statusOr) qb = qb.or(statusOr);
  if (sqlShow) qb = applyShowTypeSqlFilter(qb, sqlShow);
  if (q) {
    const safe = escapeIlikePattern(q);
    qb = qb.ilike("name", `%${safe}%`);
  }

  const { data, error } = await qb;
  if (error) return { ...empty(), error: error.message };

  const fetched = (data ?? []) as EventResultsPageRow[];
  const filtered = filterRowsByShow(fetched, show).filter((e) =>
    eventMatchesAdminStatusFilter(e, status)
  );
  const rows = sortAdminEventRowsByDate(filtered, status).slice(0, limit);
  const hasMore = fetched.length >= fetchLimit || (plePostFilter && filtered.length > limit);

  return {
    rows,
    fetchedCount: fetched.length,
    hasMore,
    limit,
    status,
    show,
  };
}
