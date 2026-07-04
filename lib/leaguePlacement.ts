import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getAdminClient } from "@/lib/supabase/admin";
import { isPublicLeagueRegistrationOpen } from "@/lib/publicLeagueRegistration";
import { isPublicSalaryCapLeague } from "@/lib/publicLeagueSchedule";

export type LeaguePlacementStatus = "pending" | "active";

export type LeagueMemberPlacementRow = {
  placement_status?: string | null;
  onboarding_completed_at?: string | null;
  /** Active (unreleased) wrestlers on this member's roster. */
  active_roster_count?: number;
};

export type LeaguePlacementContext = {
  visibility_type?: string | null;
  league_type?: string | null;
  season_slug?: string | null;
};

function rosterStarted(member: LeagueMemberPlacementRow): boolean {
  return (member.active_roster_count ?? 0) > 0;
}

/** True when this member should appear in standings and count toward league start. */
export function isPlacedLeagueMember(
  member: LeagueMemberPlacementRow,
  league?: LeaguePlacementContext | null
): boolean {
  if (league && isPublicSalaryCapLeague(league)) {
    if (member.placement_status === "active") return true;
    if (rosterStarted(member)) return true;
    if (member.placement_status === "pending") return false;
    return Boolean(member.onboarding_completed_at?.trim());
  }
  if (member.placement_status === "pending") return false;
  if (member.placement_status === "active") return true;
  return true;
}

export async function attachActiveRosterCountsToMembers<T extends { user_id: string }>(
  client: Pick<SupabaseClient, "from">,
  leagueId: string,
  members: T[]
): Promise<(T & { active_roster_count: number })[]> {
  if (members.length === 0) return [];
  const { data: rosterRows } = await client
    .from("league_rosters")
    .select("user_id")
    .eq("league_id", leagueId)
    .is("released_at", null);

  const counts = new Map<string, number>();
  for (const row of rosterRows ?? []) {
    const userId = (row as { user_id: string }).user_id;
    counts.set(userId, (counts.get(userId) ?? 0) + 1);
  }

  return members.map((member) => ({
    ...member,
    active_roster_count: counts.get(member.user_id) ?? 0,
  }));
}

export function filterPlacedLeagueMembers<T extends LeagueMemberPlacementRow & { user_id: string }>(
  members: T[],
  league?: LeaguePlacementContext | null
): T[] {
  if (!league || !isPublicSalaryCapLeague(league)) return members;
  return members.filter((m) => isPlacedLeagueMember(m, league));
}

export async function countPlacedLeagueMembers(
  admin: Pick<SupabaseClient, "from">,
  leagueId: string,
  league?: LeaguePlacementContext | null
): Promise<number> {
  if (league && isPublicSalaryCapLeague(league)) {
    const { data: members, error } = await admin
      .from("league_members")
      .select("user_id, placement_status, onboarding_completed_at")
      .eq("league_id", leagueId);
    if (error || !members) return 0;
    const enriched = await attachActiveRosterCountsToMembers(admin, leagueId, members as { user_id: string }[]);
    return enriched.filter((m) => isPlacedLeagueMember(m, league)).length;
  }
  const { count } = await admin
    .from("league_members")
    .select("*", { count: "exact", head: true })
    .eq("league_id", leagueId);
  return count ?? 0;
}

export async function activateLeaguePlacement(
  leagueId: string,
  userId: string,
  options?: { completeSetup?: boolean }
): Promise<{ error?: string }> {
  const admin = getAdminClient();
  if (!admin) return { error: "Server configuration error." };

  const completeSetup = options?.completeSetup ?? false;
  const now = new Date().toISOString();
  const update: { placement_status: string; onboarding_completed_at?: string } = {
    placement_status: "active",
  };
  if (completeSetup) {
    update.onboarding_completed_at = now;
  }

  const { error } = await admin
    .from("league_members")
    .update(update)
    .eq("league_id", leagueId)
    .eq("user_id", userId);

  if (error) {
    if (/placement_status/i.test(error.message ?? "")) {
      if (!completeSetup) return {};
      const { error: fallbackErr } = await admin
        .from("league_members")
        .update({ onboarding_completed_at: now })
        .eq("league_id", leagueId)
        .eq("user_id", userId);
      if (fallbackErr) return { error: fallbackErr.message };
      return {};
    }
    return { error: error.message };
  }
  return {};
}

/** Place a pending member once they have at least one wrestler (setup can continue). */
export async function maybeActivatePlacementForStartedRoster(
  leagueId: string,
  userId: string
): Promise<{ activated: boolean; error?: string }> {
  const admin = getAdminClient();
  if (!admin) return { activated: false, error: "Server configuration error." };

  const { data: member, error: memberErr } = await admin
    .from("league_members")
    .select("placement_status")
    .eq("league_id", leagueId)
    .eq("user_id", userId)
    .maybeSingle();
  if (memberErr || !member) return { activated: false };

  if ((member as { placement_status?: string | null }).placement_status === "active") {
    return { activated: false };
  }

  const { count, error: countErr } = await admin
    .from("league_rosters")
    .select("*", { count: "exact", head: true })
    .eq("league_id", leagueId)
    .eq("user_id", userId)
    .is("released_at", null);
  if (countErr || (count ?? 0) === 0) return { activated: false };

  const result = await activateLeaguePlacement(leagueId, userId, { completeSetup: false });
  if (result.error) return { activated: false, error: result.error };
  return { activated: true };
}

/** Persist active placement for pending members who already have wrestlers on roster. */
export async function syncLeaguePlacementFromRosters(
  leagueId: string,
  league?: LeaguePlacementContext | null
): Promise<number> {
  if (!league || !isPublicSalaryCapLeague(league)) return 0;
  const admin = getAdminClient();
  if (!admin) return 0;

  let memberRows: {
    user_id: string;
    placement_status?: string | null;
    onboarding_completed_at?: string | null;
  }[] = [];

  const primary = await admin
    .from("league_members")
    .select("user_id, placement_status, onboarding_completed_at")
    .eq("league_id", leagueId);

  if (!primary.error) {
    memberRows = (primary.data ?? []) as typeof memberRows;
  } else if (/placement_status/i.test(primary.error.message ?? "")) {
    const fallback = await admin
      .from("league_members")
      .select("user_id, onboarding_completed_at")
      .eq("league_id", leagueId);
    if (fallback.error) return 0;
    memberRows = (fallback.data ?? []) as typeof memberRows;
  } else {
    return 0;
  }

  const enriched = await attachActiveRosterCountsToMembers(admin, leagueId, memberRows);
  let updated = 0;
  for (const row of enriched) {
    if (!isPlacedLeagueMember(row, league)) continue;
    if (row.placement_status === "active") continue;
    const result = await activateLeaguePlacement(leagueId, row.user_id, { completeSetup: false });
    if (!result.error) updated++;
  }
  return updated;
}

export async function markPublicLeagueJoinPending(
  leagueSlug: string,
  userId: string
): Promise<void> {
  const admin = getAdminClient();
  if (!admin || !leagueSlug || !userId) return;

  const { data: league } = await admin
    .from("leagues")
    .select("id, visibility_type, league_type, season_slug")
    .eq("slug", leagueSlug)
    .maybeSingle();
  if (!league || !isPublicSalaryCapLeague(league as LeaguePlacementContext)) return;

  const leagueId = (league as { id: string }).id;
  const { error } = await admin
    .from("league_members")
    .update({ placement_status: "pending", onboarding_completed_at: null })
    .eq("league_id", leagueId)
    .eq("user_id", userId);

  if (error && !/placement_status/i.test(error.message ?? "")) {
    console.error("markPublicLeagueJoinPending:", error.message);
  }
}

async function listUnplacedMemberUserIds(
  admin: Pick<SupabaseClient, "from">,
  leagueId: string,
  league?: LeaguePlacementContext | null
): Promise<string[]> {
  const { data, error } = await admin
    .from("league_members")
    .select("user_id, placement_status, onboarding_completed_at")
    .eq("league_id", leagueId);

  if (error) {
    if (/placement_status/i.test(error.message ?? "")) {
      const { data: legacy } = await admin
        .from("league_members")
        .select("user_id, onboarding_completed_at")
        .eq("league_id", leagueId)
        .is("onboarding_completed_at", null);
      const legacyRows = (legacy ?? []) as { user_id: string }[];
      if (!league || !isPublicSalaryCapLeague(league)) {
        return legacyRows.map((r) => r.user_id);
      }
      const enriched = await attachActiveRosterCountsToMembers(admin, leagueId, legacyRows);
      return enriched
        .filter((row) => !isPlacedLeagueMember(row, league))
        .map((row) => row.user_id);
    }
    return [];
  }

  const rows = (data ?? []) as { user_id: string; placement_status?: string | null; onboarding_completed_at?: string | null }[];
  const enriched = await attachActiveRosterCountsToMembers(admin, leagueId, rows);
  return enriched
    .filter((row) => !isPlacedLeagueMember(row, league))
    .map((row) => row.user_id);
}

async function ensureCommissionerAfterMemberRemoval(
  admin: Pick<SupabaseClient, "from">,
  leagueId: string
): Promise<void> {
  const { data: league } = await admin
    .from("leagues")
    .select("commissioner_id")
    .eq("id", leagueId)
    .maybeSingle();
  const commissionerId = (league as { commissioner_id?: string | null } | null)?.commissioner_id ?? null;
  if (!commissionerId) return;

  const { data: members } = await admin
    .from("league_members")
    .select("user_id, role")
    .eq("league_id", leagueId)
    .order("joined_at", { ascending: true });

  const rows = (members ?? []) as { user_id: string; role?: string | null }[];
  if (rows.length === 0) return;

  if (rows.some((m) => m.user_id === commissionerId)) return;

  const next = rows[0];
  await admin.from("leagues").update({ commissioner_id: next.user_id }).eq("id", leagueId);
  await admin.from("league_members").update({ role: "owner" }).eq("league_id", leagueId);
  await admin
    .from("league_members")
    .update({ role: "commissioner" })
    .eq("league_id", leagueId)
    .eq("user_id", next.user_id);
}

/**
 * Remove public salary-cap members with no wrestlers on roster once enrollment closes
 * (Monday RAW 5 PM PT). Returns number of memberships removed.
 */
export async function purgeUnplacedPublicLeagueMembersIfRegistrationClosed(
  leagueId: string,
  league: LeaguePlacementContext & { registration_closes_at?: string | null; public_status?: string | null },
  nowMs: number = Date.now()
): Promise<number> {
  if (!isPublicSalaryCapLeague(league)) return 0;
  if (isPublicLeagueRegistrationOpen(league, nowMs)) return 0;

  const admin = getAdminClient();
  if (!admin) return 0;

  const userIds = await listUnplacedMemberUserIds(admin, leagueId, league);
  if (userIds.length === 0) return 0;

  for (const userId of userIds) {
    await admin.from("league_rosters").delete().eq("league_id", leagueId).eq("user_id", userId);
    await admin.from("league_draft_preferences").delete().eq("league_id", leagueId).eq("user_id", userId);
    await admin.from("league_members").delete().eq("league_id", leagueId).eq("user_id", userId);
  }

  await ensureCommissionerAfterMemberRemoval(admin, leagueId);
  return userIds.length;
}
