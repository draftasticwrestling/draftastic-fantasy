import type { SupabaseClient } from "@supabase/supabase-js";
import { applyXpGrant } from "@/lib/xp/applyXpGrant";
import { XP_AMOUNTS } from "@/lib/xp/xpReasons";

const ENGAGE_EVENT_NAMES = ["auth.sign_in", "page.logged_in_view", "session.logged_in_start"] as const;

function utcDateFromOccurredAt(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

function yesterdayUtcYmd(today: string): string {
  const d = new Date(`${today}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export type BackfillEngagementDailyXpResult = {
  usersProcessed: number;
  uniqueEngagementDays: number;
  dailyGrants: number;
  streakMilestoneGrants: number;
};

/**
 * Backfill daily_login + streak milestone XP from historical engagement_events.
 * Uses the same idempotency keys as production (processDailyLoginXp / awardUserXp).
 * Does not write login_streak / last_daily_login (avoids clobbering fresher state from live sign-ins).
 */
export async function backfillEngagementDailyXp(
  admin: SupabaseClient,
  opts: {
    dryRun: boolean;
    userIds: Set<string> | null;
    /** Inclusive lower bound on occurred_at (ISO date YYYY-MM-DD). */
    fromDate?: string | null;
    log: (msg: string) => void;
  }
): Promise<BackfillEngagementDailyXpResult> {
  const out: BackfillEngagementDailyXpResult = {
    usersProcessed: 0,
    uniqueEngagementDays: 0,
    dailyGrants: 0,
    streakMilestoneGrants: 0,
  };

  const pageSize = 1000;
  let offset = 0;
  const byUser = new Map<string, Set<string>>();

  for (;;) {
    let q = admin
      .from("engagement_events")
      .select("user_id, occurred_at")
      .not("user_id", "is", null)
      .in("event_name", [...ENGAGE_EVENT_NAMES])
      .order("occurred_at", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (opts.fromDate) {
      q = q.gte("occurred_at", `${opts.fromDate}T00:00:00.000Z`);
    }
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as { user_id: string; occurred_at: string }[];
    if (rows.length === 0) break;
    for (const r of rows) {
      if (opts.userIds && !opts.userIds.has(r.user_id)) continue;
      const day = utcDateFromOccurredAt(r.occurred_at);
      let set = byUser.get(r.user_id);
      if (!set) {
        set = new Set();
        byUser.set(r.user_id, set);
      }
      set.add(day);
    }
    offset += pageSize;
    if (rows.length < pageSize) break;
  }

  for (const [userId, daySet] of byUser) {
    const days = [...daySet].sort((a, b) => a.localeCompare(b));
    if (days.length === 0) continue;
    out.usersProcessed += 1;
    out.uniqueEngagementDays += days.length;

    let streak = 0;
    let prevDay: string | null = null;

    for (const d of days) {
      if (prevDay === null) {
        streak = 1;
      } else if (d === yesterdayUtcYmd(prevDay)) {
        streak += 1;
      } else {
        streak = 1;
      }
      prevDay = d;

      opts.log(`engagement daily_login user=${userId} day=${d} streak=${streak} +${XP_AMOUNTS.daily_login}`);
      if (!opts.dryRun) {
        const r = await applyXpGrant(admin, {
          userId,
          delta: XP_AMOUNTS.daily_login,
          reason: "daily_login",
          idempotencyKey: `daily_login:${userId}:${d}`,
          metadata: { backfill: true, source: "engagement_events" },
        });
        if (r.newTotal !== undefined) out.dailyGrants += 1;
      } else {
        out.dailyGrants += 1;
      }

      if (streak === 3) {
        opts.log(`engagement login_streak_3 user=${userId} day=${d} +${XP_AMOUNTS.login_streak_3}`);
        if (!opts.dryRun) {
          const r = await applyXpGrant(admin, {
            userId,
            delta: XP_AMOUNTS.login_streak_3,
            reason: "login_streak_3",
            idempotencyKey: `login_streak_3:${userId}:${d}`,
            metadata: { backfill: true, source: "engagement_events" },
          });
          if (r.newTotal !== undefined) out.streakMilestoneGrants += 1;
        } else {
          out.streakMilestoneGrants += 1;
        }
      }
      if (streak === 10) {
        opts.log(`engagement login_streak_10 user=${userId} day=${d} +${XP_AMOUNTS.login_streak_10}`);
        if (!opts.dryRun) {
          const r = await applyXpGrant(admin, {
            userId,
            delta: XP_AMOUNTS.login_streak_10,
            reason: "login_streak_10",
            idempotencyKey: `login_streak_10:${userId}:${d}`,
            metadata: { backfill: true, source: "engagement_events" },
          });
          if (r.newTotal !== undefined) out.streakMilestoneGrants += 1;
        } else {
          out.streakMilestoneGrants += 1;
        }
      }
      if (streak === 30) {
        opts.log(`engagement login_streak_30 user=${userId} day=${d} +${XP_AMOUNTS.login_streak_30}`);
        if (!opts.dryRun) {
          const r = await applyXpGrant(admin, {
            userId,
            delta: XP_AMOUNTS.login_streak_30,
            reason: "login_streak_30",
            idempotencyKey: `login_streak_30:${userId}:${d}`,
            metadata: { backfill: true, source: "engagement_events" },
          });
          if (r.newTotal !== undefined) out.streakMilestoneGrants += 1;
        } else {
          out.streakMilestoneGrants += 1;
        }
      }
    }

  }

  return out;
}
