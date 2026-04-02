/**
 * Home hub: upcoming spotlight (today/tomorrow ET) + recent completed events.
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

function hasAtLeastOneMatch(matches: unknown): boolean {
  return Array.isArray(matches) && matches.length >= 1;
}

function isNotCompleted(status: string | null | undefined): boolean {
  return (status || "").toLowerCase() !== "completed";
}

export type HubUpcomingSpotlight = HubPreviewEventRow & {
  whenLabel: "Tonight" | "Tomorrow";
};

/**
 * Single upcoming event dated today or tomorrow (ET) with ≥1 match, not completed.
 * Prefers today over tomorrow; stable tie-break by date string then name.
 */
export async function fetchHubUpcomingSpotlight(supabase: SupabaseClient): Promise<HubUpcomingSpotlight | null> {
  const { today, tomorrow } = getTodayTomorrowYmdET();
  const { data, error } = await supabase
    .from("events")
    .select("id, name, date, location, matches, status")
    .in("date", [today, tomorrow])
    .order("date", { ascending: true })
    .order("name", { ascending: true });

  if (error || !data?.length) return null;

  const candidates = (data as HubPreviewEventRow[]).filter(
    (e) => isNotCompleted(e.status) && e.date && hasAtLeastOneMatch(e.matches)
  );
  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    const da = a.date || "";
    const db = b.date || "";
    if (da !== db) return da.localeCompare(db);
    return (a.name || "").localeCompare(b.name || "");
  });

  const chosen = candidates[0];
  const whenLabel: "Tonight" | "Tomorrow" = chosen.date === today ? "Tonight" : "Tomorrow";
  return { ...chosen, whenLabel };
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
