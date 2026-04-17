/**
 * Fetch events for the top event list bar (above main nav).
 * Live shows are listed first, then recent completed events.
 */

import { unstable_cache } from "next/cache";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export type RecentEvent = {
  id: string;
  name: string | null;
  date: string | null;
  location: string | null;
  /** From PWBS: `live` while the show is in progress. */
  status?: string | null;
};

function createPublicSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  if (!url || !anon) return null;
  return createSupabaseClient(url, anon);
}

/**
 * Up to `limit` events: all current `live` rows first (newest by date), then `completed` by date until the cap.
 */
export async function getRecentEvents(limit = 15): Promise<RecentEvent[]> {
  const cap = Math.max(1, limit);
  const cached = unstable_cache(
    async (cachedCap: number) => {
      const supabase = createPublicSupabaseClient();
      if (!supabase) return [];

      const [liveRes, completedRes] = await Promise.all([
        supabase
          .from("events")
          .select("id, name, date, location, status")
          .eq("status", "live")
          .order("date", { ascending: false })
          .limit(Math.min(10, cachedCap)),
        supabase
          .from("events")
          .select("id, name, date, location, status")
          .eq("status", "completed")
          .order("date", { ascending: false })
          .limit(cachedCap),
      ]);
      if (liveRes.error && completedRes.error) return [];

      const live = (liveRes.data ?? []) as RecentEvent[];
      const completed = (completedRes.data ?? []) as RecentEvent[];
      const liveIds = new Set(live.map((e) => e.id));
      const rest = completed.filter((e) => !liveIds.has(e.id));
      return [...live, ...rest].slice(0, cachedCap);
    },
    ["recent-events"],
    { revalidate: 120 }
  );

  return cached(cap);
}
