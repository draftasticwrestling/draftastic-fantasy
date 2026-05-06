import "server-only";

import { applyXpGrant, type ApplyXpGrantParams } from "@/lib/xp/applyXpGrant";
import { getAdminClient } from "@/lib/supabase/admin";

export type AwardUserXpParams = ApplyXpGrantParams;

/**
 * Grant XP idempotently (service role). No-ops when service role is unavailable (local dev).
 */
export async function awardUserXp(params: AwardUserXpParams): Promise<{ ok: boolean; newTotal?: number }> {
  const { userId, delta, idempotencyKey } = params;
  if (!userId || !idempotencyKey || !Number.isFinite(delta) || delta === 0) return { ok: false };
  const admin = getAdminClient();
  if (!admin) return { ok: false };
  return applyXpGrant(admin, params);
}
