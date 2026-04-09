/**
 * Home hub: upcoming spotlight (today or tomorrow ET ≈ within the next day for TV) + recent completed events.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type HubPreviewEventRow = {
  id: string;
  name: string | null;
  date: string | null;
  location: string | null;
  matches: unknown;
  status?: string | null;
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

/**
 * Single next upcoming event for home “The latest”: not completed, not live.
 * Prefers today (ET), then tomorrow, then earliest future date with status still “upcoming”.
 * Includes events with no matches yet (card shows “No matches announced yet” in UI).
 */
export async function fetchHubUpcomingSpotlight(supabase: SupabaseClient): Promise<HubUpcomingSpotlight | null> {
  const { today, tomorrow } = getTodayTomorrowYmdET();

  const { data, error } = await supabase
    .from("events")
    .select("id, name, date, location, matches, status")
    .in("date", [today, tomorrow])
    .order("date", { ascending: true })
    .order("name", { ascending: true });

  if (!error && data?.length) {
    const candidates = (data as HubPreviewEventRow[]).filter((e) => isUpcomingSpotlightStatus(e.status) && e.date);
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
    .select("id, name, date, location, matches, status")
    .gte("date", today)
    .order("date", { ascending: true })
    .order("name", { ascending: true })
    .limit(25);

  if (futureErr || !futureRows?.length) return null;

  const future = (futureRows as HubPreviewEventRow[]).find((e) => isUpcomingSpotlightStatus(e.status) && e.date);
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
    .select("id, name, date, location, matches, status")
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
 * In-progress show (PWBS `status: live`) for the hub condensed card — fantasy points for completed matches only.
 */
export async function fetchHubLiveSpotlight(supabase: SupabaseClient): Promise<HubPreviewEventRow | null> {
  const { data, error } = await supabase
    .from("events")
    .select("id, name, date, location, matches, status")
    .eq("status", "live")
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data as HubPreviewEventRow;
}
