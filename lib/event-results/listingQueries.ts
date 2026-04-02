import { supabase } from "@/lib/supabase";

export type EventListingRow = {
  id: string;
  name: string | null;
  date: string | null;
  location: string | null;
  status: string | null;
};

export async function fetchCompletedEventsForListing(limit = 120): Promise<EventListingRow[]> {
  const { data, error } = await supabase
    .from("events")
    .select("id, name, date, location, status")
    .eq("status", "completed")
    .order("date", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []) as EventListingRow[];
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
