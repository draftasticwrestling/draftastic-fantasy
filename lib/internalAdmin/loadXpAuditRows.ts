import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type XpAuditRow = {
  userId: string;
  displayName: string | null;
  totalXp: number;
  loginStreak: number;
  lastDailyLogin: string | null;
  stateUpdatedAt: string | null;
};

function numXp(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number") return Math.max(0, Math.trunc(v));
  if (typeof v === "string") {
    const n = Number.parseInt(v, 10);
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  }
  return 0;
}

/**
 * All profile accounts with XP state (0 if no row yet), plus any user_xp_state rows
 * without a matching profile (display name —).
 */
export async function loadXpAuditRows(admin: SupabaseClient): Promise<XpAuditRow[]> {
  const pageSize = 500;
  const merged = new Map<string, XpAuditRow>();

  for (let offset = 0; ; offset += pageSize) {
    const { data: profs, error: profErr } = await admin
      .from("profiles")
      .select("id, display_name")
      .order("id", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (profErr) throw new Error(profErr.message);
    if (!profs?.length) break;

    const ids = (profs as { id: string }[]).map((p) => p.id);
    const { data: xpRows, error: xpErr } = await admin
      .from("user_xp_state")
      .select("user_id, total_xp, login_streak, last_daily_login, updated_at")
      .in("user_id", ids);
    if (xpErr) throw new Error(xpErr.message);

    const xpByUser = new Map<
      string,
      { total_xp: unknown; login_streak: number; last_daily_login: string | null; updated_at: string }
    >();
    for (const x of (xpRows ?? []) as Array<{
      user_id: string;
      total_xp: unknown;
      login_streak: number;
      last_daily_login: string | null;
      updated_at: string;
    }>) {
      xpByUser.set(x.user_id, x);
    }

    for (const p of profs as Array<{ id: string; display_name: string | null }>) {
      const x = xpByUser.get(p.id);
      merged.set(p.id, {
        userId: p.id,
        displayName: p.display_name,
        totalXp: numXp(x?.total_xp),
        loginStreak: x?.login_streak ?? 0,
        lastDailyLogin: x?.last_daily_login ?? null,
        stateUpdatedAt: x?.updated_at ?? null,
      });
    }
  }

  for (let offset = 0; ; offset += pageSize) {
    const { data: xpOnly, error: xpOnlyErr } = await admin
      .from("user_xp_state")
      .select("user_id, total_xp, login_streak, last_daily_login, updated_at")
      .order("user_id", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (xpOnlyErr) throw new Error(xpOnlyErr.message);
    if (!xpOnly?.length) break;

    for (const x of xpOnly as Array<{
      user_id: string;
      total_xp: unknown;
      login_streak: number;
      last_daily_login: string | null;
      updated_at: string;
    }>) {
      if (merged.has(x.user_id)) continue;
      merged.set(x.user_id, {
        userId: x.user_id,
        displayName: null,
        totalXp: numXp(x.total_xp),
        loginStreak: x.login_streak ?? 0,
        lastDailyLogin: x.last_daily_login ?? null,
        stateUpdatedAt: x.updated_at ?? null,
      });
    }
  }

  return [...merged.values()].sort((a, b) => b.totalXp - a.totalXp || a.userId.localeCompare(b.userId));
}
