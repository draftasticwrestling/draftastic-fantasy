/**
 * Fetch events for the top event list bar (above main nav).
 * Live shows are listed first, then recent completed events.
 */

import { createClient } from "@/lib/supabase/server";

export type RecentEvent = {
  id: string;
  name: string | null;
  date: string | null;
  location: string | null;
  /** From PWBS: `live` while the show is in progress. */
  status?: string | null;
};

/**
 * Up to `limit` events: all current `live` rows first (newest by date), then `completed` by date until the cap.
 */
export async function getRecentEvents(limit = 15): Promise<RecentEvent[]> {
  const supabase = await createClient();
  const cap = Math.max(1, limit);
  const [liveRes, completedRes] = await Promise.all([
    supabase
      .from("events")
      .select("id, name, date, location, status")
      .eq("status", "live")
      .order("date", { ascending: false })
      .limit(Math.min(10, cap)),
    supabase
      .from("events")
      .select("id, name, date, location, status")
      .eq("status", "completed")
      .order("date", { ascending: false })
      .limit(cap),
  ]);
  if (liveRes.error && completedRes.error) return [];

  const live = (liveRes.data ?? []) as RecentEvent[];
  const completed = (completedRes.data ?? []) as RecentEvent[];
  const liveIds = new Set(live.map((e) => e.id));
  const rest = completed.filter((e) => !liveIds.has(e.id));
  return [...live, ...rest].slice(0, cap);
}
