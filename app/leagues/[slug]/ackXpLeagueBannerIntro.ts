"use server";

import { getServerAuth } from "@/lib/supabase/serverAuth";
import { getAdminClient } from "@/lib/supabase/admin";

/** Persist one-time league home XP intro dismissal (service role; verifies session user). */
export async function ackXpLeagueBannerIntroAction(): Promise<{ ok: boolean }> {
  const { user } = await getServerAuth();
  if (!user?.id) return { ok: false };
  const admin = getAdminClient();
  if (!admin) return { ok: false };

  const now = new Date().toISOString();
  const { data: row } = await admin.from("user_xp_state").select("user_id").eq("user_id", user.id).maybeSingle();

  if (row) {
    const { error } = await admin
      .from("user_xp_state")
      .update({ xp_league_banner_intro_seen: true, updated_at: now })
      .eq("user_id", user.id);
    return { ok: !error };
  }

  const { error } = await admin.from("user_xp_state").insert({
    user_id: user.id,
    xp_league_banner_intro_seen: true,
    updated_at: now,
  });
  return { ok: !error };
}
