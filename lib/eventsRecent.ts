/**
 * Fetch recent completed events for the event list bar (e.g. above main nav).
 */

import { createClient } from "@/lib/supabase/server";

export type RecentEvent = {
  id: string;
  name: string | null;
  date: string | null;
  location: string | null;
};

/** Last N completed events, most recent first. */
export async function getRecentEvents(limit = 15): Promise<RecentEvent[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .select("id, name, date, location")
    .eq("status", "completed")
    .order("date", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []) as RecentEvent[];
}
