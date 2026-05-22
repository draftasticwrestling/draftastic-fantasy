import { createClient } from "@/lib/supabase/server";

async function assertLeagueMember(
  supabase: Awaited<ReturnType<typeof createClient>>,
  leagueId: string,
  userId: string
): Promise<{ error?: string }> {
  const { data: member } = await supabase
    .from("league_members")
    .select("user_id")
    .eq("league_id", leagueId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!member) return { error: "You are not in this league." };
  return {};
}

/**
 * Add a wrestler to the current user's watchlist for a league. Idempotent.
 */
export async function addToWatchlist(
  leagueId: string,
  wrestlerId: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const lid = leagueId?.trim();
  const id = wrestlerId?.trim();
  if (!lid) return { error: "League is required" };
  if (!id) return { error: "Wrestler is required" };

  const memberCheck = await assertLeagueMember(supabase, lid, user.id);
  if (memberCheck.error) return memberCheck;

  const { error } = await supabase.from("user_watchlist").upsert(
    { user_id: user.id, league_id: lid, wrestler_id: id },
    { onConflict: "user_id,league_id,wrestler_id" }
  );
  return error ? { error: error.message } : {};
}

/**
 * Remove a wrestler from the current user's watchlist for a league.
 */
export async function removeFromWatchlist(
  leagueId: string,
  wrestlerId: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const lid = leagueId?.trim();
  const id = wrestlerId?.trim();
  if (!lid) return { error: "League is required" };
  if (!id) return { error: "Wrestler is required" };

  const { error } = await supabase
    .from("user_watchlist")
    .delete()
    .eq("user_id", user.id)
    .eq("league_id", lid)
    .eq("wrestler_id", id);
  return error ? { error: error.message } : {};
}

/**
 * Get wrestler IDs on the current user's watchlist for a league.
 */
export async function getWatchlistWrestlerIds(leagueId: string): Promise<string[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const lid = leagueId?.trim();
  if (!lid) return [];

  const { data } = await supabase
    .from("user_watchlist")
    .select("wrestler_id")
    .eq("user_id", user.id)
    .eq("league_id", lid)
    .order("created_at", { ascending: false });
  return (data ?? []).map((r) => r.wrestler_id);
}
