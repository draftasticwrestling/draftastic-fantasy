import type { SupabaseClient } from "@supabase/supabase-js";
import { getCivilYmdInPst } from "@/lib/pstCivilTime";
import { isSyntheticAcquiredTimestamp, isSyntheticReleasedTimestamp } from "@/lib/rosterTimestamps";

export type RosterStintEnrichmentRow = {
  user_id: string;
  wrestler_id: string;
  contract?: string | null;
  acquired_at: string;
  released_at: string | null;
  acquired_at_ts?: string | null;
  released_at_ts?: string | null;
};

type ActivityRow = {
  activity_type: string;
  user_id: string;
  wrestler_id: string;
  created_at: string;
};

/** True when `acquired_at_ts` / `released_at_ts` is a date-only placeholder, not a real move clock. */
export function stintNeedsActivityTimestampEnrichment(stint: {
  acquired_at: string;
  released_at: string | null;
  acquired_at_ts?: string | null;
  released_at_ts?: string | null;
}): boolean {
  const acqYmd = String(stint.acquired_at ?? "").slice(0, 10);
  if (isSyntheticAcquiredTimestamp(stint.acquired_at_ts, acqYmd)) return true;
  if (stint.released_at != null) {
    const relYmd = String(stint.released_at).slice(0, 10);
    if (isSyntheticReleasedTimestamp(stint.released_at_ts, relYmd)) return true;
  }
  return false;
}

function activityMatchesStintAdd(stint: RosterStintEnrichmentRow, row: ActivityRow): boolean {
  if (row.activity_type !== "fa_add") return false;
  if (row.user_id !== stint.user_id) return false;
  if (row.wrestler_id !== stint.wrestler_id) return false;
  const acqYmd = String(stint.acquired_at ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(acqYmd)) return false;
  const createdMs = Date.parse(String(row.created_at));
  if (!Number.isFinite(createdMs)) return false;
  const createdPt = getCivilYmdInPst(createdMs);
  const createdUtc = new Date(createdMs).toISOString().slice(0, 10);
  return createdPt === acqYmd || createdUtc === acqYmd;
}

function activityMatchesStintDrop(stint: RosterStintEnrichmentRow, row: ActivityRow): boolean {
  if (row.activity_type !== "drop") return false;
  if (row.user_id !== stint.user_id) return false;
  if (row.wrestler_id !== stint.wrestler_id) return false;
  if (stint.released_at == null) return false;
  const relYmd = String(stint.released_at).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(relYmd)) return false;
  const createdMs = Date.parse(String(row.created_at));
  if (!Number.isFinite(createdMs)) return false;
  const createdPt = getCivilYmdInPst(createdMs);
  const createdUtc = new Date(createdMs).toISOString().slice(0, 10);
  return createdPt === relYmd || createdUtc === relYmd;
}

export function enrichRosterStintsWithActivityTimestamps<T extends RosterStintEnrichmentRow>(
  stints: T[],
  activityRows: ActivityRow[]
): T[] {
  if (!activityRows.length) return stints;
  return stints.map((stint) => {
    let acquired_at_ts = stint.acquired_at_ts ?? null;
    let released_at_ts = stint.released_at_ts ?? null;
    const acqYmd = String(stint.acquired_at ?? "").slice(0, 10);

    if (isSyntheticAcquiredTimestamp(acquired_at_ts, acqYmd)) {
      const candidates = activityRows
        .filter((row) => activityMatchesStintAdd(stint, row))
        .sort((a, b) => Date.parse(String(b.created_at)) - Date.parse(String(a.created_at)));
      const best = candidates[0];
      if (best?.created_at) acquired_at_ts = String(best.created_at);
    }

    if (stint.released_at != null) {
      const relYmd = String(stint.released_at).slice(0, 10);
      if (isSyntheticReleasedTimestamp(released_at_ts, relYmd)) {
        const candidates = activityRows
          .filter((row) => activityMatchesStintDrop(stint, row))
          .sort((a, b) => Date.parse(String(b.created_at)) - Date.parse(String(a.created_at)));
        const best = candidates[0];
        if (best?.created_at) released_at_ts = String(best.created_at);
      }
    }

    if (acquired_at_ts === stint.acquired_at_ts && released_at_ts === stint.released_at_ts) return stint;
    return { ...stint, acquired_at_ts, released_at_ts };
  });
}

export async function fetchLeagueActivityForStintEnrichment(
  supabase: SupabaseClient,
  leagueId: string
): Promise<ActivityRow[]> {
  const { data, error } = await supabase
    .from("league_activity")
    .select("activity_type, user_id, wrestler_id, created_at")
    .eq("league_id", leagueId)
    .in("activity_type", ["fa_add", "drop"])
    .order("created_at", { ascending: false });
  if (error) return [];
  return (data ?? []) as ActivityRow[];
}
