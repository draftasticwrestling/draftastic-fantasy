import "server-only";

import { getAdminClient } from "@/lib/supabase/admin";
import { getXpLevelInfo } from "@/lib/xp/xpLevels";

export type XpDisplay = {
  totalXp: number;
  level: number;
  label: string;
  title: string;
};

function defaultXp(): XpDisplay {
  const info = getXpLevelInfo(0);
  return { totalXp: 0, level: info.level, label: info.label, title: info.title };
}

/** Batch-read XP for standings / league home. Defaults every id to 0 XP when missing or on read errors. */
export async function getXpDisplayByUserIds(userIds: string[]): Promise<Record<string, XpDisplay>> {
  const uniq = [...new Set(userIds.filter(Boolean))];
  const out: Record<string, XpDisplay> = Object.fromEntries(uniq.map((id) => [id, defaultXp()]));

  const admin = getAdminClient();
  if (!admin || uniq.length === 0) return out;

  const { data, error } = await admin.from("user_xp_state").select("user_id, total_xp").in("user_id", uniq);
  if (error) return out;

  for (const row of data ?? []) {
    const r = row as { user_id?: string; total_xp?: number | null };
    const uid = r.user_id;
    if (!uid) continue;
    const xp = Math.max(0, Number(r.total_xp ?? 0));
    const info = getXpLevelInfo(xp);
    out[uid] = { totalXp: xp, level: info.level, label: info.label, title: info.title };
  }
  return out;
}
