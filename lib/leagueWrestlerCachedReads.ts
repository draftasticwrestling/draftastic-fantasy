import { unstable_cache } from "next/cache";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { getCurrentChampionsFromChampionshipsTable } from "@/lib/championshipCurrentFromTable";
import { getCurrentChampionsFromChanges } from "@/lib/championshipCurrentFromChanges";

type EventRow = { id: string; name: string; date: string; matches?: object[] };
type WrestlerRow = {
  id: string;
  name: string | null;
  gender: string | null;
  brand: string | null;
  image_url?: string | null;
  dob?: string | null;
  Status?: string | null;
  "2K26 rating"?: number | null;
  "2K25 rating"?: number | null;
};

function createPublicSupabaseClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  if (!url || !anon) return null;
  return createSupabaseClient(url, anon);
}

const readWrestlersCached = unstable_cache(
  async (): Promise<{ data: WrestlerRow[]; error: string | null }> => {
    const supabase = createPublicSupabaseClient();
    if (!supabase) return { data: [], error: "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY." };
    const res = await supabase
      .from("wrestlers")
      .select('id, name, gender, brand, image_url, dob, "Status", "2K26 rating", "2K25 rating"')
      .order("name", { ascending: true });
    return {
      data: (res.data ?? []) as WrestlerRow[],
      error: res.error?.message ?? null,
    };
  },
  ["league-wrestlers-shared-v1"],
  { revalidate: 300 }
);

const readChampionshipHistoryCached = unstable_cache(
  async (): Promise<unknown[]> => {
    const supabase = createPublicSupabaseClient();
    if (!supabase) return [];
    const { data } = await supabase.from("championship_history").select("*");
    return (data ?? []) as unknown[];
  },
  ["championship-history-shared-v1"],
  { revalidate: 300 }
);

const readEventsSinceCached = unstable_cache(
  async (startDate: string): Promise<EventRow[]> => {
    const supabase = createPublicSupabaseClient();
    if (!supabase) return [];
    const { data } = await supabase
      .from("events")
      .select("id, name, date, matches")
      .in("status", ["completed", "live"])
      .gte("date", startDate)
      .order("date", { ascending: true });
    return (data ?? []) as EventRow[];
  },
  ["league-events-since-shared-v1"],
  { revalidate: 300 }
);

const readEventsRangeCached = unstable_cache(
  async (fromDate: string, limit: number): Promise<EventRow[]> => {
    const supabase = createPublicSupabaseClient();
    if (!supabase) return [];
    const { data } = await supabase
      .from("events")
      .select("id, name, date, matches")
      .in("status", ["completed", "live"])
      .gte("date", fromDate)
      .order("date", { ascending: true })
      .limit(limit);
    return (data ?? []) as EventRow[];
  },
  ["league-events-range-shared-v1"],
  { revalidate: 300 }
);

const readCurrentChampionsFromTableCached = unstable_cache(
  async (): Promise<Record<string, { title: string; wonDate: string }>> => {
    const supabase = createPublicSupabaseClient();
    if (!supabase) return {};
    return await getCurrentChampionsFromChampionshipsTable(supabase);
  },
  ["current-champions-table-shared-v1"],
  { revalidate: 300 }
);

const readCurrentChampionsFromChangesCached = unstable_cache(
  async (): Promise<Record<string, { title: string; wonDate: string }>> => {
    const supabase = createPublicSupabaseClient();
    if (!supabase) return {};
    return await getCurrentChampionsFromChanges(supabase);
  },
  ["current-champions-changes-shared-v1"],
  { revalidate: 300 }
);

export async function getCachedWrestlersForLeagueViews() {
  return await readWrestlersCached();
}

export async function getCachedChampionshipHistoryRows() {
  return await readChampionshipHistoryCached();
}

export async function getCachedEventsSince(startDate: string) {
  return await readEventsSinceCached(startDate);
}

export async function getCachedEventsFrom(fromDate: string, limit: number) {
  return await readEventsRangeCached(fromDate, limit);
}

export async function getCachedCurrentChampionsFromTable() {
  return await readCurrentChampionsFromTableCached();
}

export async function getCachedCurrentChampionsFromChanges() {
  return await readCurrentChampionsFromChangesCached();
}

export function getPublicSupabaseForLeagueViews(): SupabaseClient | null {
  return createPublicSupabaseClient();
}
