import { supabase } from "@/lib/supabase";

export type EventListingRow = {
  id: string;
  name: string | null;
  date: string | null;
  location: string | null;
  status: string | null;
};

export type FetchCompletedListingParams = {
  limit?: number;
  /** Zero-based offset into completed events ordered by date descending (newest first). */
  offset?: number;
};

export type CompletedEventsPageResult = {
  events: EventListingRow[];
  hasMore: boolean;
};

const DEFAULT_COMPLETED_PAGE = 50;
const MAX_COMPLETED_PAGE = 100;
const MAX_OFFSET = 20_000;

/**
 * One page of completed events plus hasMore (fetches limit+1 rows to detect a next page).
 */
export async function fetchCompletedEventsPage(
  offset = 0,
  pageSize = DEFAULT_COMPLETED_PAGE
): Promise<CompletedEventsPageResult> {
  let limit = Math.min(Math.max(1, pageSize), MAX_COMPLETED_PAGE);
  let safeOffset = Math.min(Math.max(0, offset), MAX_OFFSET);
  const fetchCount = limit + 1;
  const rangeEnd = safeOffset + fetchCount - 1;

  const { data, error } = await supabase
    .from("events")
    .select("id, name, date, location, status")
    .eq("status", "completed")
    .order("date", { ascending: false })
    .range(safeOffset, rangeEnd);
  if (error) return { events: [], hasMore: false };

  const rows = (data ?? []) as EventListingRow[];
  const hasMore = rows.length > limit;
  const events = hasMore ? rows.slice(0, limit) : rows;
  return { events, hasMore };
}

/**
 * Completed events for the public Results index (single slice, no hasMore).
 * Prefer {@link fetchCompletedEventsPage} for pagination.
 */
export async function fetchCompletedEventsForListing(
  opts: FetchCompletedListingParams | number = {}
): Promise<EventListingRow[]> {
  let limit = DEFAULT_COMPLETED_PAGE;
  let offset = 0;
  if (typeof opts === "number") {
    limit = opts;
  } else {
    limit = opts.limit ?? DEFAULT_COMPLETED_PAGE;
    offset = opts.offset ?? 0;
  }
  const { events } = await fetchCompletedEventsPage(offset, limit);
  return events;
}

/** Future events not marked completed (scheduled / in progress in Boxscore). */
export async function fetchUpcomingEventsForListing(limit = 80): Promise<EventListingRow[]> {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("events")
    .select("id, name, date, location, status")
    .gte("date", today)
    .order("date", { ascending: true })
    .limit(200);
  if (error) return [];
  const rows = (data ?? []) as EventListingRow[];
  return rows.filter((e) => (e.status || "").toLowerCase() !== "completed").slice(0, limit);
}
