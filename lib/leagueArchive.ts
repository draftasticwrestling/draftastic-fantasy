import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { addDaysToYmd } from "@/lib/publicLeagueSchedule";
import { getCivilYmdInPst, isPastEndOfDayPst } from "@/lib/pstCivilTime";
import { seasonKeyForLeague } from "@/lib/leagueSeasonPlacements";
import {
  LEAGUE_AUTO_ARCHIVE_DAYS_AFTER_END,
  LEAGUE_AUTO_ARCHIVE_REASON,
  PRIVATE_LEAGUE_ABANDON_ARCHIVE_REASON,
  PRIVATE_LEAGUE_INACTIVE_REASON,
} from "@/lib/leagueArchiveConstants";
import { getMinimumTeamsForLeagueType } from "@/lib/leagueStructure";
import {
  createdOnYmd,
  isDueForPrivateAbandonArchive,
  isDueForPrivateInactive,
  isPublicVisibility,
  privateAbandonArchiveEligibleOnYmd,
  privateInactiveEligibleOnYmd,
} from "@/lib/leagueAdminLifecycle";

export {
  LEAGUE_AUTO_ARCHIVE_DAYS_AFTER_END,
  LEAGUE_AUTO_ARCHIVE_REASON,
} from "@/lib/leagueArchiveConstants";

type LeagueArchiveCandidate = {
  id: string;
  name: string | null;
  slug: string | null;
  end_date: string | null;
  season_slug: string | null;
  draft_status: string | null;
  is_archived: boolean | null;
};

type PrivateLifecycleRow = {
  id: string;
  name: string | null;
  slug: string | null;
  created_at: string | null;
  draft_status: string | null;
  league_type: string | null;
  visibility_type: string | null;
  is_archived: boolean | null;
  is_inactive: boolean | null;
  inactivated_at: string | null;
};

async function memberCountsByLeagueId(
  admin: SupabaseClient,
  leagueIds: string[]
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (leagueIds.length === 0) return out;
  const { data, error } = await admin.from("league_members").select("league_id").in("league_id", leagueIds);
  if (error || !data) return out;
  for (const row of data as { league_id: string }[]) {
    out.set(row.league_id, (out.get(row.league_id) ?? 0) + 1);
  }
  return out;
}

function archiveEligibleOnYmd(endDateYmd: string): string {
  return addDaysToYmd(endDateYmd.slice(0, 10), LEAGUE_AUTO_ARCHIVE_DAYS_AFTER_END);
}

/**
 * True when the season has ended (EOD Pacific on end_date) and at least
 * {@link LEAGUE_AUTO_ARCHIVE_DAYS_AFTER_END} calendar days have elapsed since end_date.
 */
export function isLeagueDueForAutoArchive(
  endDate: string | null | undefined,
  nowMs: number = Date.now()
): boolean {
  const endYmd = String(endDate ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(endYmd)) return false;
  if (!isPastEndOfDayPst(endYmd, nowMs)) return false;
  const todayYmd = getCivilYmdInPst(nowMs);
  return todayYmd >= archiveEligibleOnYmd(endYmd);
}

/**
 * Completed, non-archived leagues whose end_date was at least two weeks ago (Pacific calendar).
 * Prefers leagues that already have a champion placement so finalize/XP can finish first.
 */
export async function listLeaguesDueForAutoArchive(
  admin: SupabaseClient,
  nowMs: number = Date.now()
): Promise<LeagueArchiveCandidate[]> {
  const todayYmd = getCivilYmdInPst(nowMs);
  const latestEndStillEligible = addDaysToYmd(todayYmd, -LEAGUE_AUTO_ARCHIVE_DAYS_AFTER_END);

  const { data, error } = await admin
    .from("leagues")
    .select("id, name, slug, end_date, season_slug, draft_status, is_archived")
    .eq("draft_status", "completed")
    .eq("is_archived", false)
    .not("end_date", "is", null)
    .lte("end_date", latestEndStillEligible);

  if (error || !data) return [];

  const candidates = (data as LeagueArchiveCandidate[]).filter((league) =>
    isLeagueDueForAutoArchive(league.end_date, nowMs)
  );
  if (candidates.length === 0) return [];

  const leagueIds = candidates.map((l) => l.id);
  const seasonKeys = [...new Set(candidates.map((l) => seasonKeyForLeague(l)))];

  const { data: placements } = await admin
    .from("league_season_placements")
    .select("league_id, season_key")
    .in("league_id", leagueIds)
    .in("season_key", seasonKeys)
    .eq("placement", 1);

  const placed = new Set(
    ((placements ?? []) as Array<{ league_id: string; season_key: string }>).map(
      (p) => `${p.league_id}::${p.season_key}`
    )
  );

  // Archive only when a champion row exists for this season — keeps H2H pending finals visible.
  return candidates.filter((league) => placed.has(`${league.id}::${seasonKeyForLeague(league)}`));
}

/**
 * Idempotent batch archive for leagues past the two-week post-season window.
 */
export async function archiveCompletedLeagues(
  admin: SupabaseClient,
  opts?: { dryRun?: boolean; limit?: number; nowMs?: number }
): Promise<{
  leagues: number;
  archived: number;
  skipped: number;
  error: number;
  results: Array<{ leagueId: string; slug: string | null; status: "archived" | "skipped" | "error"; message: string }>;
}> {
  const due = await listLeaguesDueForAutoArchive(admin, opts?.nowMs);
  const limit = opts?.limit && opts.limit > 0 ? opts.limit : due.length;
  const slice = due.slice(0, limit);
  const results: Array<{
    leagueId: string;
    slug: string | null;
    status: "archived" | "skipped" | "error";
    message: string;
  }> = [];
  let archived = 0;
  let skipped = 0;
  let errorCount = 0;

  for (const league of slice) {
    const endYmd = String(league.end_date ?? "").slice(0, 10);
    const eligible = archiveEligibleOnYmd(endYmd);
    if (opts?.dryRun) {
      skipped += 1;
      results.push({
        leagueId: league.id,
        slug: league.slug,
        status: "skipped",
        message: `dryRun: would archive (end ${endYmd}, eligible from ${eligible})`,
      });
      continue;
    }

    const res = await admin
      .from("leagues")
      .update({
        is_archived: true,
        archived_at: new Date(opts?.nowMs ?? Date.now()).toISOString(),
        archived_by: null,
        archive_reason: LEAGUE_AUTO_ARCHIVE_REASON,
      })
      .eq("id", league.id)
      .eq("is_archived", false);

    if (res.error) {
      errorCount += 1;
      results.push({
        leagueId: league.id,
        slug: league.slug,
        status: "error",
        message: res.error.message,
      });
      continue;
    }

    archived += 1;
    results.push({
      leagueId: league.id,
      slug: league.slug,
      status: "archived",
      message: LEAGUE_AUTO_ARCHIVE_REASON,
    });
  }

  return {
    leagues: slice.length,
    archived,
    skipped,
    error: errorCount,
    results,
  };
}

async function listPrivateLifecycleCandidates(
  admin: SupabaseClient
): Promise<Array<PrivateLifecycleRow & { member_count: number }>> {
  const { data, error } = await admin
    .from("leagues")
    .select(
      "id, name, slug, created_at, draft_status, league_type, visibility_type, is_archived, is_inactive, inactivated_at"
    )
    .eq("is_archived", false)
    .order("created_at", { ascending: true })
    .limit(500);

  if (error) {
    if (/is_inactive|inactivated_at/i.test(error.message ?? "") || error.code === "42703") {
      return [];
    }
    return [];
  }
  if (!data?.length) return [];

  const rows = (data as PrivateLifecycleRow[]).filter((r) => !isPublicVisibility(r.visibility_type));
  const counts = await memberCountsByLeagueId(
    admin,
    rows.map((r) => r.id)
  );
  return rows.map((r) => ({ ...r, member_count: counts.get(r.id) ?? 0 }));
}

/**
 * Mark underfilled private leagues inactive after 2 weeks; archive them after 4 weeks from creation.
 * Also clears inactive when a league later becomes fully started.
 */
export async function processPrivateLeagueInactivity(
  admin: SupabaseClient,
  opts?: { dryRun?: boolean; limit?: number; nowMs?: number }
): Promise<{
  candidates: number;
  markedInactive: number;
  reactivated: number;
  archived: number;
  skipped: number;
  error: number;
  results: Array<{
    leagueId: string;
    slug: string | null;
    status: "inactive" | "reactivated" | "archived" | "skipped" | "error";
    message: string;
  }>;
}> {
  const nowMs = opts?.nowMs ?? Date.now();
  const todayYmd = getCivilYmdInPst(nowMs);
  const all = await listPrivateLifecycleCandidates(admin);
  const actionable = all.filter((league) => {
    const hasMinOwners = league.member_count >= getMinimumTeamsForLeagueType(league.league_type);
    return (
      (Boolean(league.is_inactive) && hasMinOwners) ||
      isDueForPrivateAbandonArchive(league, nowMs) ||
      isDueForPrivateInactive(league, nowMs)
    );
  });
  const limit = opts?.limit && opts.limit > 0 ? opts.limit : actionable.length;
  const slice = actionable.slice(0, limit);

  const results: Array<{
    leagueId: string;
    slug: string | null;
    status: "inactive" | "reactivated" | "archived" | "skipped" | "error";
    message: string;
  }> = [];
  let markedInactive = 0;
  let reactivated = 0;
  let archived = 0;
  let skipped = 0;
  let errorCount = 0;

  for (const league of slice) {
    const createdYmd = createdOnYmd(league.created_at) ?? String(league.created_at ?? "").slice(0, 10);

    const hasMinOwners = league.member_count >= getMinimumTeamsForLeagueType(league.league_type);

    if (Boolean(league.is_inactive) && hasMinOwners) {
      if (opts?.dryRun) {
        skipped += 1;
        results.push({
          leagueId: league.id,
          slug: league.slug,
          status: "skipped",
          message: "dryRun: would reactivate (now fully started)",
        });
        continue;
      }
      const res = await admin
        .from("leagues")
        .update({ is_inactive: false, inactivated_at: null })
        .eq("id", league.id)
        .eq("is_inactive", true);
      if (res.error) {
        errorCount += 1;
        results.push({ leagueId: league.id, slug: league.slug, status: "error", message: res.error.message });
      } else {
        reactivated += 1;
        results.push({
          leagueId: league.id,
          slug: league.slug,
          status: "reactivated",
          message: "Cleared inactive — league now has the format minimum of owners",
        });
      }
      continue;
    }

    if (isDueForPrivateAbandonArchive(league, nowMs)) {
      const eligible = privateAbandonArchiveEligibleOnYmd(createdYmd);
      if (opts?.dryRun) {
        skipped += 1;
        results.push({
          leagueId: league.id,
          slug: league.slug,
          status: "skipped",
          message: `dryRun: would abandon-archive (created ${createdYmd}, eligible from ${eligible}; today ${todayYmd})`,
        });
        continue;
      }
      const res = await admin
        .from("leagues")
        .update({
          is_archived: true,
          archived_at: new Date(nowMs).toISOString(),
          archived_by: null,
          archive_reason: PRIVATE_LEAGUE_ABANDON_ARCHIVE_REASON,
          is_inactive: true,
          inactivated_at: league.inactivated_at ?? new Date(nowMs).toISOString(),
        })
        .eq("id", league.id)
        .eq("is_archived", false);
      if (res.error) {
        errorCount += 1;
        results.push({ leagueId: league.id, slug: league.slug, status: "error", message: res.error.message });
      } else {
        archived += 1;
        results.push({
          leagueId: league.id,
          slug: league.slug,
          status: "archived",
          message: PRIVATE_LEAGUE_ABANDON_ARCHIVE_REASON,
        });
      }
      continue;
    }

    if (isDueForPrivateInactive(league, nowMs)) {
      const eligible = privateInactiveEligibleOnYmd(createdYmd);
      if (opts?.dryRun) {
        skipped += 1;
        results.push({
          leagueId: league.id,
          slug: league.slug,
          status: "skipped",
          message: `dryRun: would mark inactive (created ${createdYmd}, eligible from ${eligible})`,
        });
        continue;
      }
      const res = await admin
        .from("leagues")
        .update({
          is_inactive: true,
          inactivated_at: new Date(nowMs).toISOString(),
        })
        .eq("id", league.id)
        .eq("is_inactive", false);
      if (res.error) {
        errorCount += 1;
        results.push({ leagueId: league.id, slug: league.slug, status: "error", message: res.error.message });
      } else {
        markedInactive += 1;
        results.push({
          leagueId: league.id,
          slug: league.slug,
          status: "inactive",
          message: PRIVATE_LEAGUE_INACTIVE_REASON,
        });
      }
    }
  }

  return {
    candidates: actionable.length,
    markedInactive,
    reactivated,
    archived,
    skipped,
    error: errorCount,
    results,
  };
}

/** Run post-season archive + private underfilled inactive/abandon lifecycle. */
export async function runLeagueLifecycleMaintenance(
  admin: SupabaseClient,
  opts?: { dryRun?: boolean; limit?: number; nowMs?: number }
) {
  const completed = await archiveCompletedLeagues(admin, opts);
  const privateLife = await processPrivateLeagueInactivity(admin, opts);
  return { completed, privateLife };
}
