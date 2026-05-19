import { normalizeEventDateForUrl } from "@/lib/event-results/eventResultsRoute";
import { getTodayTomorrowYmdET } from "@/lib/home/hubHomeEvents";
import type { SiteAdminEventStatusFilter } from "@/lib/internalAdmin/boxscoreEventsListParams";

/** Calendar "today" for WWE show dates (Eastern). */
export function getAdminEventListTodayYmd(): string {
  return getTodayTomorrowYmdET().today;
}

function compareYmd(a: string, b: string): number {
  return a.localeCompare(b);
}

/** PWBS: upcoming show on or before today still appears under Completed with this tag. */
export function isEventResultsPending(event: {
  status?: string | null;
  date?: string | null;
}): boolean {
  const status = (event.status ?? "").trim().toLowerCase();
  if (status !== "upcoming") return false;
  const ymd = normalizeEventDateForUrl(event.date);
  if (!ymd) return false;
  return compareYmd(ymd, getAdminEventListTodayYmd()) <= 0;
}

export function eventMatchesAdminStatusFilter(
  event: { status?: string | null; date?: string | null },
  filter: SiteAdminEventStatusFilter
): boolean {
  const status = (event.status ?? "").trim().toLowerCase();
  const ymd = normalizeEventDateForUrl(event.date);
  const today = getAdminEventListTodayYmd();

  if (filter === "all") return true;
  if (filter === "live") return status === "live";
  if (filter === "upcoming") {
    if (status !== "upcoming") return false;
    if (!ymd) return true;
    return compareYmd(ymd, today) > 0;
  }
  if (filter === "completed") {
    if (status === "completed") return true;
    return isEventResultsPending(event);
  }
  return true;
}

/** PostgREST `.or()` filter for status tab (before show-type post-filter). */
export function buildAdminEventStatusOrFilter(filter: SiteAdminEventStatusFilter): string | null {
  if (filter === "all") return null;
  const today = getAdminEventListTodayYmd();
  if (filter === "live") return "status.eq.live";
  if (filter === "upcoming") return `and(status.eq.upcoming,date.gt.${today})`;
  if (filter === "completed") {
    return `status.eq.completed,and(status.eq.upcoming,date.lte.${today})`;
  }
  return null;
}
