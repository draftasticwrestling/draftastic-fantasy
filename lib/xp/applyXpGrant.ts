import type { SupabaseClient } from "@supabase/supabase-js";

export type ApplyXpGrantParams = {
  userId: string;
  delta: number;
  reason: string;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
};

/**
 * Grant XP idempotently using the given service-role client (used by awardUserXp and CLI scripts).
 */
export async function applyXpGrant(
  admin: SupabaseClient,
  params: ApplyXpGrantParams
): Promise<{ ok: boolean; newTotal?: number }> {
  const { userId, delta, reason, idempotencyKey, metadata } = params;
  if (!userId || !idempotencyKey || !Number.isFinite(delta) || delta === 0) return { ok: false };

  const { data: existing } = await admin.from("user_xp_ledger").select("id").eq("idempotency_key", idempotencyKey).maybeSingle();
  if (existing) return { ok: true };

  const d = Math.trunc(delta);
  if (d <= 0) return { ok: false };

  const { error: ledgerErr } = await admin.from("user_xp_ledger").insert({
    user_id: userId,
    delta: d,
    reason,
    idempotency_key: idempotencyKey,
    metadata: metadata ?? {},
  });
  if (ledgerErr) {
    if (/duplicate key|unique constraint/i.test(ledgerErr.message ?? "")) return { ok: true };
    console.error("[xp] ledger insert failed", ledgerErr.message);
    return { ok: false };
  }

  const { data: stateRow } = await admin
    .from("user_xp_state")
    .select("total_xp, fantasy_points_tiers_claimed, login_streak, last_daily_login")
    .eq("user_id", userId)
    .maybeSingle();
  const prev =
    (stateRow as {
      total_xp?: number;
      fantasy_points_tiers_claimed?: number;
      login_streak?: number;
      last_daily_login?: string | null;
    } | null) ?? null;
  const nextTotal = Math.max(0, (prev?.total_xp ?? 0) + d);

  const { error: upsertErr } = await admin.from("user_xp_state").upsert(
    {
      user_id: userId,
      total_xp: nextTotal,
      fantasy_points_tiers_claimed: prev?.fantasy_points_tiers_claimed ?? 0,
      login_streak: prev?.login_streak ?? 0,
      last_daily_login: prev?.last_daily_login ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (upsertErr) {
    console.error("[xp] state upsert failed", upsertErr.message);
    return { ok: false };
  }

  return { ok: true, newTotal: nextTotal };
}
