"use server";

import { getServerAuth } from "@/lib/supabase/serverAuth";
import { getAdminClient } from "@/lib/supabase/admin";
import { getXpLevelInfo } from "@/lib/xp/xpLevels";

function readTotalXp(row: unknown): number {
  const v = (row as { total_xp?: unknown } | null)?.total_xp;
  if (v == null) return 0;
  if (typeof v === "number") return Math.max(0, Math.trunc(v));
  const n = Number.parseInt(String(v), 10);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

/** After dismissing a level-up banner (or intro), persist the celebrated level so it is not shown again. */
export async function ackXpLeagueBannerLevelAction(opts?: {
  markIntroSeen?: boolean;
}): Promise<{ ok: boolean }> {
  const { user } = await getServerAuth();
  if (!user?.id) return { ok: false };
  const admin = getAdminClient();
  if (!admin) return { ok: false };

  const { data: row } = await admin
    .from("user_xp_state")
    .select("total_xp, xp_league_banner_intro_seen")
    .eq("user_id", user.id)
    .maybeSingle();

  const totalXp = readTotalXp(row);
  const level = getXpLevelInfo(totalXp).level;
  const now = new Date().toISOString();
  const introSeen =
    opts?.markIntroSeen === true ||
    (row as { xp_league_banner_intro_seen?: boolean } | null)?.xp_league_banner_intro_seen === true;

  const patch = {
    xp_league_banner_last_celebrated_level: level,
    xp_league_banner_intro_seen: introSeen,
    xp_league_banner_level_replay_done: true,
    updated_at: now,
  };

  if (row) {
    const { error } = await admin.from("user_xp_state").update(patch).eq("user_id", user.id);
    return { ok: !error };
  }

  const { error } = await admin.from("user_xp_state").insert({
    user_id: user.id,
    total_xp: totalXp,
    ...patch,
  });
  return { ok: !error };
}
