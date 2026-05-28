import "server-only";

import { getAdminClient } from "@/lib/supabase/admin";

export type NotificationPrefs = {
  notify_trade_proposals: boolean;
  notify_trade_accepted: boolean;
  notify_trade_finalized: boolean;
  notify_gm_trade_approval: boolean;
  notify_event_scores: boolean;
  notify_draft_reminder: boolean;
  notify_weekly_results: boolean;
};

const DEFAULT_PREFS: NotificationPrefs = {
  notify_trade_proposals: true,
  notify_trade_accepted: true,
  notify_trade_finalized: true,
  notify_gm_trade_approval: true,
  notify_event_scores: true,
  notify_draft_reminder: true,
  notify_weekly_results: true,
};

export type UserEmailTarget = {
  userId: string;
  email: string;
  displayName: string | null;
  prefs: NotificationPrefs;
};

function rowToPrefs(row: Record<string, unknown> | null): NotificationPrefs {
  if (!row) return { ...DEFAULT_PREFS };
  return {
    notify_trade_proposals: row.notify_trade_proposals !== false,
    notify_trade_accepted: row.notify_trade_accepted !== false,
    notify_trade_finalized:
      row.notify_trade_finalized !== undefined && row.notify_trade_finalized !== null
        ? row.notify_trade_finalized !== false
        : row.notify_trade_accepted !== false,
    notify_draft_reminder: row.notify_draft_reminder !== false,
    notify_weekly_results: row.notify_weekly_results !== false,
    notify_gm_trade_approval: row.notify_gm_trade_approval !== false,
    notify_event_scores: row.notify_event_scores !== false,
  };
}

export async function loadNotificationPrefsForUser(
  userId: string
): Promise<NotificationPrefs> {
  const admin = getAdminClient();
  if (!admin) return { ...DEFAULT_PREFS };

  const full = await admin
    .from("profiles")
    .select(
      "notify_trade_proposals, notify_trade_accepted, notify_trade_finalized, notify_gm_trade_approval, notify_event_scores, notify_draft_reminder, notify_weekly_results"
    )
    .eq("id", userId)
    .maybeSingle();

  if (!full.error && full.data) {
    return rowToPrefs(full.data as Record<string, unknown>);
  }

  const legacy = await admin
    .from("profiles")
    .select("notify_trade_proposals, notify_draft_reminder, notify_weekly_results")
    .eq("id", userId)
    .maybeSingle();

  if (legacy.error || !legacy.data) return { ...DEFAULT_PREFS };
  const base = rowToPrefs(legacy.data as Record<string, unknown>);
  return {
    ...base,
    notify_trade_accepted: base.notify_trade_proposals,
    notify_trade_finalized: base.notify_trade_proposals,
    notify_gm_trade_approval: true,
    notify_event_scores: true,
  };
}

export async function resolveUserEmailTarget(userId: string): Promise<UserEmailTarget | null> {
  const admin = getAdminClient();
  if (!admin) return null;

  const [{ data: authData, error: authErr }, prefs, profileRow] = await Promise.all([
    admin.auth.admin.getUserById(userId),
    loadNotificationPrefsForUser(userId),
    admin.from("profiles").select("display_name").eq("id", userId).maybeSingle(),
  ]);

  if (authErr) {
    console.warn("[email] getUserById failed:", userId, authErr.message);
    return null;
  }
  const email = authData?.user?.email?.trim();
  if (!email) return null;

  return {
    userId,
    email,
    displayName: (profileRow.data as { display_name?: string | null } | null)?.display_name ?? null,
    prefs,
  };
}
