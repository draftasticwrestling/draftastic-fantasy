import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getEventShowType } from "@/lib/boxscore/eventShowHeader";
import {
  EVENT_RESULTS_PAGE_SELECT,
  type EventResultsPageRow,
  parseEventResultsSlugParam,
  buildEventResultsSlug,
} from "@/lib/event-results/eventResultsRoute";
import { escapeIlikePattern } from "@/lib/internalAdmin/escapeIlike";

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

export async function siteAdminSearchEvents(
  admin: SupabaseClient,
  opts: { q?: string; date?: string; id?: string }
): Promise<{ rows: EventResultsPageRow[]; error?: string }> {
  const id = opts.id?.trim();
  if (id) {
    const one = await siteAdminGetEventByParam(admin, id);
    return { rows: one ? [one] : [] };
  }

  const date = opts.date?.trim();
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const { data, error } = await admin
      .from("events")
      .select(EVENT_RESULTS_PAGE_SELECT)
      .eq("date", date)
      .order("name", { ascending: true })
      .limit(80);
    if (error) return { rows: [], error: error.message };
    return { rows: (data ?? []) as EventResultsPageRow[] };
  }

  const q = opts.q?.trim();
  let qb = admin.from("events").select(EVENT_RESULTS_PAGE_SELECT).order("date", { ascending: false }).limit(45);

  if (q) {
    const safe = escapeIlikePattern(q);
    qb = qb.ilike("name", `%${safe}%`);
  }

  const { data, error } = await qb;
  if (error) return { rows: [], error: error.message };
  return { rows: (data ?? []) as EventResultsPageRow[] };
}
