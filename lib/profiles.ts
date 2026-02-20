import { createClient } from "@/lib/supabase/server";

export type Profile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  timezone: string | null;
  notify_trade_proposals: boolean;
  notify_draft_reminder: boolean;
  notify_weekly_results: boolean;
  created_at: string;
  updated_at: string;
};

/**
 * Fetch a profile by user id (server-side). Returns null if not found or not authenticated.
 */
export async function getProfile(userId: string): Promise<Profile | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url, timezone, notify_trade_proposals, notify_draft_reminder, notify_weekly_results, created_at, updated_at")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return data as Profile;
}

/**
 * Update the current user's profile (server-side). Caller must be authenticated.
 */
export async function updateProfile(
  userId: string,
  updates: {
    display_name?: string | null;
    avatar_url?: string | null;
    timezone?: string | null;
    notify_trade_proposals?: boolean;
    notify_draft_reminder?: boolean;
    notify_weekly_results?: boolean;
  }
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id !== userId) {
    return { error: "Unauthorized" };
  }
  const { error } = await supabase
    .from("profiles")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);
  return { error: error?.message ?? null };
}
