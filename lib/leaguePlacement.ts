import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getAdminClient } from "@/lib/supabase/admin";
import { isPublicLeagueRegistrationOpen } from "@/lib/publicLeagueRegistration";
import { isPublicSalaryCapLeague } from "@/lib/publicLeagueSchedule";

export type LeaguePlacementStatus = "pending" | "active";

export type LeagueMemberPlacementRow = {
  placement_status?: string | null;
  onboarding_completed_at?: string | null;
};

export type LeaguePlacementContext = {
  visibility_type?: string | null;
  league_type?: string | null;
  season_slug?: string | null;
};

/** True when this member should appear in standings and count toward league start. */
export function isPlacedLeagueMember(
  member: LeagueMemberPlacementRow,
  league?: LeaguePlacementContext | null
): boolean {
  if (member.placement_status === "pending") return false;
  if (member.placement_status === "active") return true;
  if (league && isPublicSalaryCapLeague(league)) {
    return Boolean(member.onboarding_completed_at?.trim());
  }
  return true;
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
    const { count, error } = await admin
      .from("league_members")
      .select("*", { count: "exact", head: true })
      .eq("league_id", leagueId)
      .eq("placement_status", "active");
    if (!error && count != null) return count;
    const { count: legacyCount } = await admin
      .from("league_members")
      .select("*", { count: "exact", head: true })
      .eq("league_id", leagueId)
      .not("onboarding_completed_at", "is", null);
    return legacyCount ?? 0;
  }
  const { count } = await admin
    .from("league_members")
    .select("*", { count: "exact", head: true })
    .eq("league_id", leagueId);
  return count ?? 0;
}

export async function activateLeaguePlacement(
  leagueId: string,
  userId: string
): Promise<{ error?: string }> {
  const admin = getAdminClient();
  if (!admin) return { error: "Server configuration error." };

  const now = new Date().toISOString();
  const { error } = await admin
    .from("league_members")
    .update({
      placement_status: "active",
      onboarding_completed_at: now,
    })
    .eq("league_id", leagueId)
    .eq("user_id", userId);

  if (error) {
    if (/placement_status/i.test(error.message ?? "")) {
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

function isUnplacedMemberRow(row: LeagueMemberPlacementRow): boolean {
  return !isPlacedLeagueMember(row);
}

async function listUnplacedMemberUserIds(
  admin: Pick<SupabaseClient, "from">,
  leagueId: string
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
      return (legacy ?? []).map((r) => (r as { user_id: string }).user_id);
    }
    return [];
  }

  return (data ?? [])
    .filter((row) => isUnplacedMemberRow(row as LeagueMemberPlacementRow))
    .map((row) => (row as { user_id: string }).user_id);
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
 * Remove public salary-cap members who never finished roster setup once enrollment closes
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

  const userIds = await listUnplacedMemberUserIds(admin, leagueId);
  if (userIds.length === 0) return 0;

  for (const userId of userIds) {
    await admin.from("league_rosters").delete().eq("league_id", leagueId).eq("user_id", userId);
    await admin.from("league_draft_preferences").delete().eq("league_id", leagueId).eq("user_id", userId);
    await admin.from("league_members").delete().eq("league_id", leagueId).eq("user_id", userId);
  }

  await ensureCommissionerAfterMemberRemoval(admin, leagueId);
  return userIds.length;
}
