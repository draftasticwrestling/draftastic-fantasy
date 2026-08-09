import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getAdminClient } from "@/lib/supabase/admin";
import { isRoadToWarGamesSeasonSlug } from "@/lib/leagueStructure";
import { getMondayOfWeek } from "@/lib/fantasyWeekBounds";
import { getCivilYmdInPst } from "@/lib/pstCivilTime";
import { getLeagueRosterValidationFailures } from "@/lib/leagueRosterValidation";

type AdminClient = NonNullable<ReturnType<typeof getAdminClient>>;

async function getNextWweEventDateOnOrAfter(
  admin: AdminClient,
  fromYmd: string
): Promise<string | null> {
  const { data, error } = await admin
    .from("events")
    .select("date")
    .gte("date", fromYmd)
    .order("date", { ascending: true })
    .limit(1);
  if (error || !data?.length) return null;
  const date = (data[0] as { date?: string | null }).date;
  return typeof date === "string" && date.length >= 10 ? date.slice(0, 10) : null;
}

/**
 * Road to War Games: when a private league's draft is completed + approved, lock
 * the league to the number of teams that actually drafted and set the scoring start date.
 */
export async function lockRoadToWarGamesLeagueOnApproval(
  leagueId: string,
  client?: SupabaseClient | null
): Promise<void> {
  const admin = client ?? getAdminClient();
  if (!admin) return;
  const { data: league } = await admin
    .from("leagues")
    .select("season_slug, league_type")
    .eq("id", leagueId)
    .maybeSingle();
  const seasonSlug = (league as { season_slug?: string | null } | null)?.season_slug ?? null;
  if (!isRoadToWarGamesSeasonSlug(seasonSlug)) return;

  const leagueType = ((league as { league_type?: string | null } | null)?.league_type ?? "").trim();
  const isHeadToHead = leagueType === "head_to_head" || leagueType === "combo";

  const { count: memberCount } = await admin
    .from("league_members")
    .select("user_id", { count: "exact", head: true })
    .eq("league_id", leagueId);
  const draftedTeams = memberCount ?? 0;

  const approvalYmd = getCivilYmdInPst(Date.now());
  let scoringStartYmd = approvalYmd;
  if (isHeadToHead) {
    const monday = getMondayOfWeek(approvalYmd);
    const d = new Date(monday + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() + 7);
    scoringStartYmd = d.toISOString().slice(0, 10);
  } else {
    const nextEvent = await getNextWweEventDateOnOrAfter(admin as AdminClient, approvalYmd);
    if (nextEvent) scoringStartYmd = nextEvent;
  }

  const update: Record<string, unknown> = {
    start_date: scoringStartYmd,
    draft_date: null,
  };
  if (draftedTeams >= 3 && draftedTeams <= 16) update.max_teams = draftedTeams;

  await admin.from("leagues").update(update).eq("id", leagueId);
}

export type DraftFinalizeResult = {
  status: "completed" | "ready_for_review";
  failureCount: number;
  error?: string;
};

/**
 * After autopick/offline draft finishing: auto-approve when rosters pass size/gender checks;
 * otherwise leave/set ready_for_review for site-admin attention.
 */
export async function finalizeDraftWithRosterValidation(
  leagueId: string,
  opts?: {
    client?: SupabaseClient | null;
    /** Clear pick cursor fields (autopick end). */
    clearCursor?: boolean;
  }
): Promise<DraftFinalizeResult> {
  const admin = opts?.client ?? getAdminClient();
  if (!admin) return { status: "ready_for_review", failureCount: 0, error: "Admin client unavailable" };

  const failures = await getLeagueRosterValidationFailures(leagueId, admin);
  const clearCursor = Boolean(opts?.clearCursor);

  if (failures.length === 0) {
    const payload: Record<string, unknown> = {
      draft_status: "completed",
      is_inactive: false,
      inactivated_at: null,
    };
    if (clearCursor) {
      payload.draft_current_pick = null;
      payload.draft_current_pick_started_at = null;
    }
    let res = await admin.from("leagues").update(payload).eq("id", leagueId);
    if (res.error && /is_inactive|inactivated_at/i.test(res.error.message ?? "")) {
      const fallback: Record<string, unknown> = { draft_status: "completed" };
      if (clearCursor) {
        fallback.draft_current_pick = null;
        fallback.draft_current_pick_started_at = null;
      }
      res = await admin.from("leagues").update(fallback).eq("id", leagueId);
    }
    if (res.error) {
      return { status: "ready_for_review", failureCount: 0, error: res.error.message };
    }
    await lockRoadToWarGamesLeagueOnApproval(leagueId, admin);
    return { status: "completed", failureCount: 0 };
  }

  const payload: Record<string, unknown> = { draft_status: "ready_for_review" };
  if (clearCursor) {
    payload.draft_current_pick = null;
    payload.draft_current_pick_started_at = null;
  }
  const res = await admin.from("leagues").update(payload).eq("id", leagueId);
  if (res.error) {
    return { status: "ready_for_review", failureCount: failures.length, error: res.error.message };
  }
  return { status: "ready_for_review", failureCount: failures.length };
}
