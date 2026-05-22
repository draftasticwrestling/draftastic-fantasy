import { getEffectiveLeagueStartDate } from "@/lib/leagues";

/** Public leagues and leagues past their start date cannot change league type. */
export function isLeagueTypeChangeAllowed(league: {
  visibility_type?: string | null;
  start_date?: string | null;
  draft_date?: string | null;
  created_at?: string;
}): boolean {
  if (String(league.visibility_type ?? "").toLowerCase() === "public") {
    return false;
  }
  const todayYmd = new Date().toISOString().slice(0, 10);
  const leagueStartYmd = getEffectiveLeagueStartDate({
    start_date: league.start_date ?? null,
    draft_date: league.draft_date ?? null,
    created_at: league.created_at,
  });
  return todayYmd < leagueStartYmd;
}
