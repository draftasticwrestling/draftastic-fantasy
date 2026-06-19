import { createClient } from "@/lib/supabase/server";
import { getServerAuth } from "@/lib/supabase/serverAuth";

export type Profile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  avatar_id?: string | null;
  needs_avatar_selection?: boolean;
  is_site_admin?: boolean | null;
  is_suspended?: boolean;
  suspended_until?: string | null;
  suspension_reason?: string | null;
  moderation_note?: string | null;
  accepted_terms_at?: string | null;
  accepted_privacy_at?: string | null;
  timezone: string | null;
  notify_trade_proposals: boolean;
  notify_trade_accepted: boolean;
  notify_trade_finalized: boolean;
  notify_gm_trade_approval: boolean;
  notify_event_scores: boolean;
  notify_draft_reminder: boolean;
  notify_weekly_results: boolean;
  marketing_opt_in?: boolean;
  marketing_opt_in_at?: string | null;
  marketing_opt_in_source?: string | null;
  created_at: string;
  updated_at: string;
  last_activity_at?: string | null;
};

/**
 * Fetch a profile by user id (server-side). Returns null if not found or not authenticated.
 */
export async function getProfile(userId: string): Promise<Profile | null> {
  const supabase = await createClient();
  const primary = await supabase
    .from("profiles")
    .select(
      "id, display_name, avatar_url, avatar_id, needs_avatar_selection, is_site_admin, accepted_terms_at, accepted_privacy_at, timezone, notify_trade_proposals, notify_trade_accepted, notify_trade_finalized, notify_gm_trade_approval, notify_event_scores, notify_draft_reminder, notify_weekly_results, marketing_opt_in, marketing_opt_in_at, marketing_opt_in_source, created_at, updated_at, last_activity_at"
    )
    .eq("id", userId)
    .maybeSingle();
  let row: Record<string, unknown> | null = (primary.data as Record<string, unknown> | null) ?? null;
  let error = primary.error;
  if (error && /(marketing_opt_in|last_activity_at|notify_trade_accepted|notify_trade_finalized|notify_gm_trade_approval|notify_event_scores|avatar_id|needs_avatar_selection)/i.test(error.message ?? "")) {
    const fallback = await supabase
      .from("profiles")
      .select(
        "id, display_name, avatar_url, accepted_terms_at, accepted_privacy_at, timezone, notify_trade_proposals, notify_draft_reminder, notify_weekly_results, created_at, updated_at"
      )
      .eq("id", userId)
      .maybeSingle();
    row = (fallback.data as Record<string, unknown> | null) ?? null;
    error = fallback.error;
  }
  if (error || !row) return null;
  const r = row as Profile & Record<string, unknown>;
  return {
    ...r,
    notify_trade_accepted: r.notify_trade_accepted !== false,
    notify_trade_finalized:
      r.notify_trade_finalized !== undefined && r.notify_trade_finalized !== null
        ? r.notify_trade_finalized !== false
        : r.notify_trade_accepted !== false,
    notify_gm_trade_approval: r.notify_gm_trade_approval !== false,
    notify_event_scores: r.notify_event_scores !== false,
    marketing_opt_in: Boolean((row as { marketing_opt_in?: boolean }).marketing_opt_in),
    marketing_opt_in_at: (row as { marketing_opt_in_at?: string | null }).marketing_opt_in_at ?? null,
    marketing_opt_in_source: (row as { marketing_opt_in_source?: string | null }).marketing_opt_in_source ?? null,
    needs_avatar_selection: Boolean((row as { needs_avatar_selection?: boolean }).needs_avatar_selection),
    avatar_id: (row as { avatar_id?: string | null }).avatar_id ?? null,
  };
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
    notify_trade_accepted?: boolean;
    notify_trade_finalized?: boolean;
    notify_gm_trade_approval?: boolean;
    notify_event_scores?: boolean;
    notify_draft_reminder?: boolean;
    notify_weekly_results?: boolean;
    marketing_opt_in?: boolean;
    marketing_opt_in_at?: string | null;
    marketing_opt_in_source?: string | null;
  }
): Promise<{ error: string | null }> {
  const { supabase, user } = await getServerAuth();
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
