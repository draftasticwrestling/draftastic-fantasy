import "server-only";

import { notifyAbandonedSignup } from "@/lib/email/onboardingNotifications";
import { getAdminClient } from "@/lib/supabase/admin";

const DEFAULT_MIN_ACCOUNT_AGE_DAYS = 2;
const DEFAULT_MAX_ACCOUNT_AGE_DAYS = 14;
const BATCH_LIMIT = 50;

type AuthUserRow = {
  id: string;
  email?: string | null;
  email_confirmed_at?: string | null;
  created_at?: string | null;
};

/**
 * Users with confirmed email, no league membership, and no prior abandoned-signup email.
 */
export async function runAbandonedSignupNudgeCron(): Promise<{
  scanned: number;
  sent: number;
  skipped: number;
  errors: string[];
}> {
  const admin = getAdminClient();
  if (!admin) {
    return { scanned: 0, sent: 0, skipped: 0, errors: ["Admin client unavailable."] };
  }

  const minDays = Number.parseInt(process.env.ABANDONED_SIGNUP_NUDGE_MIN_DAYS ?? "", 10);
  const maxDays = Number.parseInt(process.env.ABANDONED_SIGNUP_NUDGE_MAX_DAYS ?? "", 10);
  const minAgeDays = Number.isFinite(minDays) && minDays >= 0 ? minDays : DEFAULT_MIN_ACCOUNT_AGE_DAYS;
  const maxAgeDays = Number.isFinite(maxDays) && maxDays > minAgeDays ? maxDays : DEFAULT_MAX_ACCOUNT_AGE_DAYS;

  const now = Date.now();
  const createdBefore = new Date(now - minAgeDays * 24 * 60 * 60 * 1000).toISOString();
  const createdAfter = new Date(now - maxAgeDays * 24 * 60 * 60 * 1000).toISOString();

  const { data: listData, error: listErr } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (listErr) {
    return { scanned: 0, sent: 0, skipped: 0, errors: [listErr.message] };
  }

  const candidates = (listData?.users ?? []).filter((u) => {
    const row = u as AuthUserRow;
    if (!row.email_confirmed_at || !row.created_at) return false;
    const created = row.created_at;
    return created <= createdBefore && created >= createdAfter;
  }) as AuthUserRow[];

  if (candidates.length === 0) {
    return { scanned: 0, sent: 0, skipped: 0, errors: [] };
  }

  const candidateIds = candidates.map((u) => u.id);
  const { data: profiles, error: profilesErr } = await admin
    .from("profiles")
    .select("id, is_suspended, abandoned_signup_nudge_sent_at")
    .in("id", candidateIds);

  let profileRows: Array<{
    id: string;
    is_suspended?: boolean | null;
    abandoned_signup_nudge_sent_at?: string | null;
  }> | null = profiles;
  let trackSentAt = !profilesErr;
  if (profilesErr?.code === "42703") {
    const fallback = await admin.from("profiles").select("id, is_suspended").in("id", candidateIds);
    profileRows = (fallback.data ?? []) as Array<{
      id: string;
      is_suspended?: boolean | null;
      abandoned_signup_nudge_sent_at?: string | null;
    }>;
    trackSentAt = false;
  }

  const profileById = new Map(
    (profileRows ?? []).map((p) => [
      (p as { id: string }).id,
      p as { id: string; is_suspended?: boolean | null; abandoned_signup_nudge_sent_at?: string | null },
    ])
  );

  const { data: memberRows } = await admin.from("league_members").select("user_id").in("user_id", candidateIds);
  const usersWithLeague = new Set((memberRows ?? []).map((r) => (r as { user_id: string }).user_id));

  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const user of candidates.slice(0, BATCH_LIMIT)) {
    const profile = profileById.get(user.id);
    if (profile?.is_suspended) {
      skipped += 1;
      continue;
    }
    if (profile?.abandoned_signup_nudge_sent_at) {
      skipped += 1;
      continue;
    }
    if (usersWithLeague.has(user.id)) {
      skipped += 1;
      continue;
    }

    const ok = await notifyAbandonedSignup(user.id);
    if (!ok) {
      errors.push(`send failed for ${user.id}`);
      skipped += 1;
      continue;
    }

    if (trackSentAt) {
      const { error: markErr } = await admin
        .from("profiles")
        .update({ abandoned_signup_nudge_sent_at: new Date().toISOString() })
        .eq("id", user.id);
      if (markErr) {
        errors.push(`mark sent failed for ${user.id}: ${markErr.message}`);
      } else {
        sent += 1;
      }
    } else {
      sent += 1;
    }
  }

  return { scanned: candidates.length, sent, skipped, errors };
}
