import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { generateJoinCode } from "@/lib/leagueJoinCode";
import { snapshotLeagueSalaryCosts } from "@/lib/leagueSalarySnapshots";
import {
  PUBLIC_SALARY_CAP_H2H_MAX_TEAMS,
  PUBLIC_SALARY_CAP_SEASON_SLUG,
  SALARY_CAP_H2H_LEAGUE_TYPE,
} from "@/lib/leagueStructure";
import { getAdminClient } from "@/lib/supabase/admin";
import {
  computePublicLeagueRegistrationSchedule,
  isPublicLeagueRegistrationOpen,
  publicLeagueMinimumTeams,
} from "@/lib/publicLeagueRegistration";
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

export type UnplacedCarryResult = {
  moved: number;
  destinationSlug: string | null;
  movedUserIds: string[];
};

type CarryMember = {
  user_id: string;
  team_name?: string | null;
  manager_avatar_url?: string | null;
  manager_catchphrase?: string | null;
};

type OpenPublicLeague = {
  id: string;
  slug: string;
  max_teams: number | null;
};

/**
 * When a public league is actually starting, move members who never added a wrestler
 * into the next open public league. They stay pending, so they do not count toward
 * the league that is locking in. If that league is still short of its minimum and
 * registration will be extended, they stay put.
 */
export async function carryUnplacedPublicLeagueMembersWhenLeagueStarts(
  leagueId: string,
  league: LeaguePlacementContext & { registration_closes_at?: string | null; public_status?: string | null },
  nowMs: number = Date.now()
): Promise<UnplacedCarryResult> {
  const empty: UnplacedCarryResult = { moved: 0, destinationSlug: null, movedUserIds: [] };
  if (!isPublicSalaryCapLeague(league)) return empty;
  if (isPublicLeagueRegistrationOpen(league, nowMs)) return empty;

  const admin = getAdminClient();
  if (!admin) return empty;

  const status = String(league.public_status ?? "").toLowerCase();
  const alreadyStarted = status === "active";
  if (!alreadyStarted) {
    const placed = await countPlacedLeagueMembers(admin, leagueId, league);
    const min = publicLeagueMinimumTeams(league.league_type);
    if (placed < min) return empty;
  }

  const userIds = await listUnplacedMemberUserIds(admin, leagueId, league);
  if (userIds.length === 0) return empty;

  const { data: detailRows } = await admin
    .from("league_members")
    .select("user_id, team_name, manager_avatar_url, manager_catchphrase")
    .eq("league_id", leagueId)
    .in("user_id", userIds);
  const detailById = new Map(
    ((detailRows ?? []) as CarryMember[]).map((row) => [row.user_id, row])
  );
  const members: CarryMember[] = userIds.map((userId) => detailById.get(userId) ?? { user_id: userId });

  const movedUserIds: string[] = [];
  let destinationSlug: string | null = null;
  let remaining = members;

  while (remaining.length > 0) {
    const destination = await findOrProvisionOpenPublicLeague(admin, leagueId, remaining[0].user_id);
    if (!destination) break;
    destinationSlug = destination.slug;

    const room = await openSeatsInPublicLeague(admin, destination);
    if (room <= 0) break;
    const batch = remaining.slice(0, room);
    remaining = remaining.slice(room);

    const { count: existingCount } = await admin
      .from("league_members")
      .select("user_id", { count: "exact", head: true })
      .eq("league_id", destination.id);
    let destCount = existingCount ?? 0;

    for (const member of batch) {
      const placedThere = await moveUnplacedMemberToLeague(admin, leagueId, destination.id, member, destCount === 0);
      if (!placedThere) continue;
      destCount += 1;
      movedUserIds.push(member.user_id);
    }
  }

  if (movedUserIds.length > 0) {
    await ensureCommissionerAfterMemberRemoval(admin, leagueId);
  }

  return { moved: movedUserIds.length, destinationSlug, movedUserIds };
}

/** @deprecated Use carryUnplacedPublicLeagueMembersWhenLeagueStarts. Kept so older call sites still compile. */
export async function purgeUnplacedPublicLeagueMembersIfRegistrationClosed(
  leagueId: string,
  league: LeaguePlacementContext & { registration_closes_at?: string | null; public_status?: string | null },
  nowMs: number = Date.now()
): Promise<number> {
  const result = await carryUnplacedPublicLeagueMembersWhenLeagueStarts(leagueId, league, nowMs);
  return result.moved;
}

async function openSeatsInPublicLeague(
  admin: Pick<SupabaseClient, "from">,
  league: OpenPublicLeague
): Promise<number> {
  const { count } = await admin
    .from("league_members")
    .select("user_id", { count: "exact", head: true })
    .eq("league_id", league.id);
  const cap = league.max_teams ?? PUBLIC_SALARY_CAP_H2H_MAX_TEAMS;
  return Math.max(0, cap - (count ?? 0));
}

async function findOrProvisionOpenPublicLeague(
  admin: SupabaseClient,
  excludeLeagueId: string,
  commissionerUserId: string
): Promise<OpenPublicLeague | null> {
  const { data } = await admin
    .from("leagues")
    .select("id, slug, max_teams, league_type, season_slug, visibility_type, public_status, registration_closes_at")
    .eq("visibility_type", "public")
    .in("public_status", ["open", "awaiting_minimum"])
    .order("created_at", { ascending: true });

  for (const row of data ?? []) {
    const candidate = row as OpenPublicLeague & LeaguePlacementContext & {
      public_status?: string | null;
      registration_closes_at?: string | null;
    };
    if (candidate.id === excludeLeagueId) continue;
    if (!isPublicSalaryCapLeague(candidate)) continue;
    if (!isPublicLeagueRegistrationOpen(candidate)) continue;
    const seats = await openSeatsInPublicLeague(admin, candidate);
    if (seats > 0) return candidate;
  }

  return provisionOpenPublicLeague(admin, commissionerUserId);
}

async function provisionOpenPublicLeague(
  admin: SupabaseClient,
  commissionerUserId: string
): Promise<OpenPublicLeague | null> {
  const schedule = computePublicLeagueRegistrationSchedule();
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: seqRows } = await admin
      .from("leagues")
      .select("public_sequence")
      .eq("visibility_type", "public")
      .not("public_sequence", "is", null)
      .order("public_sequence", { ascending: false })
      .limit(1);
    const maxSeq = Number((seqRows?.[0] as { public_sequence?: number } | undefined)?.public_sequence ?? 0);
    const sequence = (Number.isFinite(maxSeq) ? maxSeq : 0) + 1 + attempt;
    const name = `Public League ${sequence}`;
    const slug = `public-league-${sequence}`;

    const { data, error } = await admin
      .from("leagues")
      .insert({
        name,
        slug,
        commissioner_id: commissionerUserId,
        start_date: schedule.season_start_ymd,
        end_date: schedule.season_end_ymd,
        season_slug: PUBLIC_SALARY_CAP_SEASON_SLUG,
        draft_date: null,
        draft_time: null,
        draft_type: "salary_cap",
        draft_style: "snake",
        draft_order_method: "manual_by_gm",
        draft_status: "in_progress",
        league_type: SALARY_CAP_H2H_LEAGUE_TYPE,
        include_nxt: true,
        max_teams: PUBLIC_SALARY_CAP_H2H_MAX_TEAMS,
        visibility_type: "public",
        public_status: "open",
        public_sequence: sequence,
        join_code: generateJoinCode(),
        registration_closes_at: schedule.registration_closes_at,
      })
      .select("id, slug, max_teams")
      .single();

    if (!error && data) {
      const created = data as OpenPublicLeague;
      await snapshotLeagueSalaryCosts(created.id);
      return created;
    }
    const code = (error as { code?: string } | null)?.code;
    if (code === "23505") continue;
    console.error("provisionOpenPublicLeague:", error?.message);
    return null;
  }
  return null;
}

async function moveUnplacedMemberToLeague(
  admin: SupabaseClient,
  sourceLeagueId: string,
  destinationLeagueId: string,
  member: CarryMember,
  asCommissioner: boolean
): Promise<boolean> {
  const { data: existing } = await admin
    .from("league_members")
    .select("user_id")
    .eq("league_id", destinationLeagueId)
    .eq("user_id", member.user_id)
    .maybeSingle();

  if (!existing) {
    const inserted = await insertCarriedMember(admin, destinationLeagueId, member, asCommissioner);
    if (!inserted) return false;
    if (asCommissioner) {
      await admin.from("leagues").update({ commissioner_id: member.user_id }).eq("id", destinationLeagueId);
    }
  }

  await admin.from("league_rosters").delete().eq("league_id", sourceLeagueId).eq("user_id", member.user_id);
  await admin.from("league_draft_preferences").delete().eq("league_id", sourceLeagueId).eq("user_id", member.user_id);
  const { error: removeError } = await admin
    .from("league_members")
    .delete()
    .eq("league_id", sourceLeagueId)
    .eq("user_id", member.user_id);
  if (removeError) {
    console.error("moveUnplacedMemberToLeague remove:", removeError.message);
    return false;
  }
  return true;
}

async function insertCarriedMember(
  admin: SupabaseClient,
  destinationLeagueId: string,
  member: CarryMember,
  asCommissioner: boolean
): Promise<boolean> {
  const base = {
    league_id: destinationLeagueId,
    user_id: member.user_id,
    role: asCommissioner ? "commissioner" : "owner",
    placement_status: "pending",
    onboarding_completed_at: null,
    team_name: member.team_name?.trim() || null,
    manager_avatar_url: member.manager_avatar_url ?? null,
    manager_catchphrase: member.manager_catchphrase?.trim() || null,
  };
  const first = await admin.from("league_members").insert(base);
  if (!first.error) return true;

  const withoutCatchphrase = { ...base, manager_catchphrase: null };
  const retry = await admin.from("league_members").insert(withoutCatchphrase);
  if (!retry.error) return true;
  console.error("insertCarriedMember:", retry.error.message);
  return false;
}
