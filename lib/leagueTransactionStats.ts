import type { SupabaseClient } from "@supabase/supabase-js";

export type LeagueTransactionStats = {
  /** Rows in `league_activity` with `activity_type = 'fa_add'`. */
  faSignings: number;
  /** Rows in `league_activity` with `activity_type = 'drop'`. */
  drops: number;
  /** Trades with `executed_at` set (fully processed). */
  completedTrades: number;
};

/**
 * Roster-related transaction counts for a league (activity feed + executed trades).
 */
export async function getLeagueTransactionStats(
  supabase: Pick<SupabaseClient, "from">,
  leagueId: string
): Promise<LeagueTransactionStats | null> {
  const [faRes, dropRes, tradeRes] = await Promise.all([
    supabase
      .from("league_activity")
      .select("id", { count: "exact", head: true })
      .eq("league_id", leagueId)
      .eq("activity_type", "fa_add"),
    supabase
      .from("league_activity")
      .select("id", { count: "exact", head: true })
      .eq("league_id", leagueId)
      .eq("activity_type", "drop"),
    supabase
      .from("league_trade_proposals")
      .select("id", { count: "exact", head: true })
      .eq("league_id", leagueId)
      .not("executed_at", "is", null),
  ]);

  const err = faRes.error ?? dropRes.error ?? tradeRes.error;
  if (err) {
    console.error("[getLeagueTransactionStats]", err.message);
    return null;
  }

  return {
    faSignings: faRes.count ?? 0,
    drops: dropRes.count ?? 0,
    completedTrades: tradeRes.count ?? 0,
  };
}
