/**
 * Home hub “The latest”: fetches spotlight / today / completed rows; ordering uses `lib/home/hubLatestSchedule`.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type HubPreviewEventRow = {
  id: string;
  name: string | null;
  date: string | null;
  location: string | null;
  matches: unknown;
  status?: string | null;
  broadcast_start_ts?: string | null;
};

/** Calendar YYYY-MM-DD in America/New_York (WWE domestic air times). */
export function getTodayTomorrowYmdET(): { today: string; tomorrow: string } {
  const et = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
  const y = et.getFullYear();
  const m = String(et.getMonth() + 1).padStart(2, "0");
  const d = String(et.getDate()).padStart(2, "0");
  const today = `${y}-${m}-${d}`;
  const t2 = new Date(et);
  t2.setDate(t2.getDate() + 1);
  const y2 = t2.getFullYear();
  const m2 = String(t2.getMonth() + 1).padStart(2, "0");
  const d2 = String(t2.getDate()).padStart(2, "0");
  const tomorrow = `${y2}-${m2}-${d2}`;
  return { today, tomorrow };
}

/** Pre-show card only: not completed and not live (live uses scored preview elsewhere). */
function isUpcomingSpotlightStatus(status: string | null | undefined): boolean {
  const s = (status || "").toLowerCase().trim();
  if (s === "completed" || s === "live") return false;
  return true;
}

export type HubUpcomingSpotlight = HubPreviewEventRow & {
  whenLabel: "Tonight" | "Tomorrow" | "Upcoming";
};

function whenLabelForDate(date: string | null, today: string, tomorrow: string): "Tonight" | "Tomorrow" | "Upcoming" {
  if (date === today) return "Tonight";
  if (date === tomorrow) return "Tomorrow";
  return "Upcoming";
}

function notExcluded(id: string | undefined, excludeEventId: string | null | undefined): boolean {
  if (!excludeEventId || !id) return true;
  return id !== excludeEventId;
}

/**
 * Single next upcoming event for home “The latest”: not completed, not live.
 * Prefers today (ET), then tomorrow, then earliest future date with status still “upcoming”.
 * Includes events with no matches yet (card shows “No matches announced yet” in UI).
 * @param excludeEventId — e.g. the live / “today’s show” card so the same event is not shown twice.
 */
export async function fetchHubUpcomingSpotlight(
  supabase: SupabaseClient,
  excludeEventId?: string | null
): Promise<HubUpcomingSpotlight | null> {
  const { today, tomorrow } = getTodayTomorrowYmdET();

  const { data, error } = await supabase
    .from("events")
    .select("id, name, date, location, matches, status, broadcast_start_ts")
    .in("date", [today, tomorrow])
    .order("date", { ascending: true })
    .order("name", { ascending: true });

  if (!error && data?.length) {
    const candidates = (data as HubPreviewEventRow[]).filter(
      (e) => notExcluded(e.id, excludeEventId) && isUpcomingSpotlightStatus(e.status) && e.date
    );
    if (candidates.length > 0) {
      candidates.sort((a, b) => {
        const da = a.date || "";
        const db = b.date || "";
        if (da !== db) return da.localeCompare(db);
        return (a.name || "").localeCompare(b.name || "");
      });
      const chosen = candidates[0];
      return { ...chosen, whenLabel: whenLabelForDate(chosen.date, today, tomorrow) };
    }
  }

  const { data: futureRows, error: futureErr } = await supabase
    .from("events")
    .select("id, name, date, location, matches, status, broadcast_start_ts")
    .gte("date", today)
    .order("date", { ascending: true })
    .order("name", { ascending: true })
    .limit(25);

  if (futureErr || !futureRows?.length) return null;

  const future = (futureRows as HubPreviewEventRow[]).find(
    (e) => notExcluded(e.id, excludeEventId) && isUpcomingSpotlightStatus(e.status) && e.date
  );
  if (!future) return null;

  return { ...future, whenLabel: whenLabelForDate(future.date, today, tomorrow) };
}

/** Recent completed events with full row payload for hub previews (most recent first). */
export async function fetchHubRecentCompleted(
  supabase: SupabaseClient,
  limit: number,
  excludeId?: string | null
): Promise<HubPreviewEventRow[]> {
  const { data, error } = await supabase
    .from("events")
    .select("id, name, date, location, matches, status, broadcast_start_ts")
    .eq("status", "completed")
    .order("date", { ascending: false })
    .limit(limit + (excludeId ? 2 : 0));

  if (error || !data) return [];
  let rows = data as HubPreviewEventRow[];
  if (excludeId) {
    rows = rows.filter((e) => e.id !== excludeId);
  }
  return rows.slice(0, limit);
}

/**
 * Primary card for **America/New_York calendar “today”**: any non-completed event on that date.
 * If several exist, prefers `status = live`, then name order. Null when no show that day (hub uses article-first layout).
 */
export async function fetchHubTodayPrimaryEvent(supabase: SupabaseClient): Promise<HubPreviewEventRow | null> {
  const { today } = getTodayTomorrowYmdET();
  const { data: rows, error } = await supabase
    .from("events")
    .select("id, name, date, location, matches, status, broadcast_start_ts")
    .eq("date", today)
    .neq("status", "completed");

  if (error || !rows?.length) return null;
  const list = rows as HubPreviewEventRow[];
  list.sort((a, b) => {
    const liveA = (a.status || "").toLowerCase().trim() === "live" ? 1 : 0;
    const liveB = (b.status || "").toLowerCase().trim() === "live" ? 1 : 0;
    if (liveA !== liveB) return liveB - liveA;
    return (a.name || "").localeCompare(b.name || "");
  });
  return list[0];
}
