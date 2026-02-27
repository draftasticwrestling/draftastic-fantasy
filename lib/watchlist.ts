import { createClient } from "@/lib/supabase/server";

/**
 * Add a wrestler to the current user's watchlist. Idempotent (no error if already added).
 */
export async function addToWatchlist(wrestlerId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  const id = wrestlerId?.trim();
  if (!id) return { error: "Wrestler is required" };

  const { error } = await supabase.from("user_watchlist").upsert(
    { user_id: user.id, wrestler_id: id },
    { onConflict: "user_id,wrestler_id" }
  );
  return error ? { error: error.message } : {};
}

/**
 * Remove a wrestler from the current user's watchlist.
 */
export async function removeFromWatchlist(wrestlerId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  const id = wrestlerId?.trim();
  if (!id) return { error: "Wrestler is required" };

  const { error } = await supabase
    .from("user_watchlist")
    .delete()
    .eq("user_id", user.id)
    .eq("wrestler_id", id);
  return error ? { error: error.message } : {};
}

/**
 * Get wrestler IDs on the current user's watchlist.
 */
export async function getWatchlistWrestlerIds(): Promise<string[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("user_watchlist")
    .select("wrestler_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  return (data ?? []).map((r) => r.wrestler_id);
}
