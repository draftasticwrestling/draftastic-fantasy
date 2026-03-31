import { cache } from "react";

import { getEventShowType, type EventShowFilter } from "@/lib/boxscore/eventShowHeader";
import { supabase } from "@/lib/supabase";

/** Columns loaded for the event results / boxscore page. */
export const EVENT_RESULTS_PAGE_SELECT =
  "id, name, date, location, matches, status, preview, recap, broadcast_start_ts";

export type EventResultsPageRow = {
  id: string;
  name: string | null;
  date: string | null;
  location: string | null;
  matches: unknown[] | null;
  status: string | null;
  preview: string | null;
  recap: string | null;
  broadcast_start_ts: string | null;
};

const CANONICAL_SLUG_RE = /^(raw|smackdown|ple)-(\d{4}-\d{2}-\d{2})$/;

/** Normalize stored date to YYYY-MM-DD for URLs (matches boxscore-style slugs). */
export function normalizeEventDateForUrl(dateStr: string | null | undefined): string | null {
  if (dateStr == null || dateStr === "") return null;
  const s = String(dateStr).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const prefix = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (prefix) return prefix[1];
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

/**
 * SEO path segment: raw|smackdown|ple plus ISO date, e.g. smackdown-2026-03-27.
 * Falls back to DB id when date is missing.
 */
export function buildEventResultsSlug(event: {
  name?: string | null;
  date?: string | null;
  id?: string | null;
}): string {
  const datePart = normalizeEventDateForUrl(event.date);
  if (!datePart) {
    const id = (event.id ?? "").toString().trim();
    return id || "event";
  }
  const show = getEventShowType(event);
  return `${show}-${datePart}`;
}

export function eventResultsHref(event: {
  name?: string | null;
  date?: string | null;
  id?: string | null;
}): string {
  return `/event-results/${buildEventResultsSlug(event)}`;
}

export function parseEventResultsSlugParam(param: string): { show: EventShowFilter; date: string } | null {
  const decoded = decodeURIComponent(param.trim()).toLowerCase();
  const m = decoded.match(CANONICAL_SLUG_RE);
  if (!m) return null;
  return { show: m[1] as EventShowFilter, date: m[2] };
}

/**
 * Public Boxscore URL for the same show (prowrestlingboxscore.com uses /events/{show}-{date} for SEO;
 * legacy /event/{dbId} for non-slug routes).
 */
export function buildProWrestlingBoxscoreEventUrl(routeParam: string, dbEventId?: string | null): string {
  const trimmed = decodeURIComponent(routeParam.trim());
  const parsed = parseEventResultsSlugParam(trimmed);
  if (parsed) {
    return `https://prowrestlingboxscore.com/events/${parsed.show}-${parsed.date}`;
  }
  const id = (dbEventId ?? trimmed).trim();
  return `https://prowrestlingboxscore.com/event/${encodeURIComponent(id)}`;
}

function pickResolvedEvent(
  candidates: EventResultsPageRow[],
  decodedParam: string
): EventResultsPageRow | null {
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];
  const exact = candidates.find((e) => buildEventResultsSlug(e) === decodedParam);
  if (exact) return exact;
  return [...candidates].sort((a, b) => a.id.localeCompare(b.id))[0];
}

/**
 * Resolve an event from the dynamic route param: DB id (any) or canonical slug
 * raw|smackdown|ple-YYYY-MM-DD. Deduplicated per request (metadata + page).
 */
export const getEventForResultsRoute = cache(async (param: string): Promise<EventResultsPageRow | null> => {
  const decoded = decodeURIComponent(param.trim());

  const { data: byId } = await supabase
    .from("events")
    .select(EVENT_RESULTS_PAGE_SELECT)
    .eq("id", decoded)
    .maybeSingle();

  if (byId) return byId as unknown as EventResultsPageRow;

  const parsed = parseEventResultsSlugParam(decoded);
  if (!parsed) return null;

  /** Same calendar day + show (raw/smackdown/ple) — include upcoming/live so hub links work before results post. */
  const { data: rows } = await supabase
    .from("events")
    .select(EVENT_RESULTS_PAGE_SELECT)
    .eq("date", parsed.date);

  const candidates = (rows ?? []).filter((e) => getEventShowType(e) === parsed.show) as EventResultsPageRow[];

  return pickResolvedEvent(candidates, decoded.toLowerCase());
});

