import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";

/** Max pages of auth users to scan when searching (100 users per page). */
const SEARCH_SCAN_MAX_PAGES = 20;

export type SiteAdminUserRow = {
  id: string;
  email: string | null;
  phone: string | null;
  display_name: string | null;
  league_count: number;
  draft_pref_count: number;
  marketing_opt_in: boolean;
  is_site_admin: boolean;
  is_suspended: boolean;
  suspended_until: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  last_activity_at: string | null;
};

export type SiteAdminUserMembership = {
  league_id: string;
  league_slug: string;
  league_name: string;
  role: string;
  joined_at: string;
  team_name: string | null;
  manager_catchphrase: string | null;
};

export type SiteAdminModerationAuditRow = {
  id: string;
  action: string;
  reason: string | null;
  actor_user_id: string;
  created_at: string;
};

export type SiteAdminUserDetail = {
  id: string;
  email: string | null;
  phone: string | null;
  display_name: string | null;
  avatar_url: string | null;
  timezone: string | null;
  is_site_admin: boolean;
  accepted_terms_at: string | null;
  accepted_privacy_at: string | null;
  is_suspended: boolean;
  suspended_until: string | null;
  suspension_reason: string | null;
  moderation_note: string | null;
  marketing_opt_in: boolean;
  marketing_opt_in_at: string | null;
  draft_pref_count: number;
  created_at: string;
  last_sign_in_at: string | null;
  last_activity_at: string | null;
  memberships: SiteAdminUserMembership[];
  audit: SiteAdminModerationAuditRow[];
};

function toRow(
  u: User,
  profile:
    | {
        display_name: string | null;
        is_site_admin: boolean;
        is_suspended: boolean;
        suspended_until: string | null;
        marketing_opt_in: boolean;
        last_activity_at: string | null;
      }
    | undefined
): SiteAdminUserRow {
  return {
    id: u.id,
    email: u.email ?? null,
    phone: u.phone ?? null,
    display_name: profile?.display_name ?? null,
    league_count: 0,
    draft_pref_count: 0,
    marketing_opt_in: profile?.marketing_opt_in ?? false,
    is_site_admin: profile?.is_site_admin ?? false,
    is_suspended: profile?.is_suspended ?? false,
    suspended_until: profile?.suspended_until ?? null,
    created_at: u.created_at ?? "",
    last_sign_in_at: u.last_sign_in_at ?? null,
    last_activity_at: profile?.last_activity_at ?? null,
  };
}

async function enrichWithProfiles(
  admin: SupabaseClient,
  users: User[]
): Promise<
  Map<
    string,
    {
      display_name: string | null;
      is_site_admin: boolean;
      is_suspended: boolean;
      suspended_until: string | null;
      marketing_opt_in: boolean;
      last_activity_at: string | null;
    }
  >
> {
  const map = new Map<
    string,
    {
      display_name: string | null;
      is_site_admin: boolean;
      is_suspended: boolean;
      suspended_until: string | null;
      marketing_opt_in: boolean;
      last_activity_at: string | null;
    }
  >();
  if (users.length === 0) return map;
  const userIds = [...new Set(users.map((u) => u.id))];
  let { data, error } = await admin
    .from("profiles")
    .select("id, display_name, is_site_admin, is_suspended, suspended_until, marketing_opt_in, last_activity_at")
    .in("id", userIds);
  if (error && /last_activity_at/i.test(error.message ?? "")) {
    const fallback = await admin
      .from("profiles")
      .select("id, display_name, is_site_admin, is_suspended, suspended_until, marketing_opt_in")
      .in("id", userIds);
    error = fallback.error;
    // Old DBs without the column: normalize shape so it matches the primary select type.
    data = (fallback.data ?? []).map((r) => ({ ...r, last_activity_at: null as string | null }));
  }
  if (error || !data) return map;
  for (const row of data) {
    map.set(row.id, {
      display_name: row.display_name ?? null,
      is_site_admin: Boolean(row.is_site_admin),
      is_suspended: Boolean(row.is_suspended),
      suspended_until: row.suspended_until ?? null,
      marketing_opt_in: Boolean((row as { marketing_opt_in?: boolean | null }).marketing_opt_in),
      last_activity_at: (row as { last_activity_at?: string | null }).last_activity_at ?? null,
    });
  }
  return map;
}

function matchesQuery(
  u: User,
  profile:
    | {
        display_name: string | null;
        is_site_admin: boolean;
        is_suspended: boolean;
        suspended_until: string | null;
      }
    | undefined,
  qLower: string
): boolean {
  const email = (u.email ?? "").toLowerCase();
  const phone = (u.phone ?? "").toLowerCase();
  const id = u.id.toLowerCase();
  const meta = u.user_metadata ?? {};
  const metaName = String(meta.full_name ?? meta.name ?? meta.user_name ?? "").toLowerCase();
  const displayName = (profile?.display_name ?? "").toLowerCase();
  return (
    email.includes(qLower) ||
    phone.includes(qLower) ||
    id.includes(qLower) ||
    metaName.includes(qLower) ||
    displayName.includes(qLower)
  );
}

async function enrichWithLeagueCounts(admin: SupabaseClient, rows: SiteAdminUserRow[]): Promise<SiteAdminUserRow[]> {
  if (rows.length === 0) return rows;
  const userIds = [...new Set(rows.map((r) => r.id))];
  const { data, error } = await admin.from("league_members").select("user_id, league_id").in("user_id", userIds);
  if (error || !data) return rows;
  const perUser = new Map<string, Set<string>>();
  for (const row of data) {
    const existing = perUser.get(row.user_id) ?? new Set<string>();
    existing.add(row.league_id);
    perUser.set(row.user_id, existing);
  }
  return rows.map((row) => ({
    ...row,
    league_count: perUser.get(row.id)?.size ?? 0,
  }));
}

async function enrichWithDraftPrefCounts(admin: SupabaseClient, rows: SiteAdminUserRow[]): Promise<SiteAdminUserRow[]> {
  if (rows.length === 0) return rows;
  const userIds = [...new Set(rows.map((r) => r.id))];
  const { data, error } = await admin
    .from("league_draft_preferences")
    .select("user_id")
    .in("user_id", userIds);
  if (error || !data) return rows;
  const perUser = new Map<string, number>();
  for (const row of data as { user_id: string }[]) {
    perUser.set(row.user_id, (perUser.get(row.user_id) ?? 0) + 1);
  }
  return rows.map((row) => ({
    ...row,
    draft_pref_count: perUser.get(row.id) ?? 0,
  }));
}

export async function siteAdminListUsers(
  admin: SupabaseClient,
  opts: { page: number; perPage: number; q: string }
): Promise<{
  rows: SiteAdminUserRow[];
  total: number;
  error: string | null;
  searchHint: string | null;
}> {
  const page = Math.max(1, Math.floor(opts.page));
  const perPage = Math.min(100, Math.max(5, Math.floor(opts.perPage)));
  const q = opts.q.trim();
  const qLower = q.toLowerCase();

  if (!q) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) {
      return { rows: [], total: 0, error: error.message, searchHint: null };
    }
    const users = data.users ?? [];
    const total = typeof data.total === "number" ? data.total : users.length;
    const profMap = await enrichWithProfiles(admin, users);
    const withLeagueCounts = await enrichWithLeagueCounts(
      admin,
      users.map((u) => toRow(u, profMap.get(u.id)))
    );
    const rows = await enrichWithDraftPrefCounts(admin, withLeagueCounts);
    return { rows, total, error: null, searchHint: null };
  }

  const matches: SiteAdminUserRow[] = [];
  let searchMayOmitUsers = false;

  for (let scanPage = 1; scanPage <= SEARCH_SCAN_MAX_PAGES; scanPage++) {
    const { data, error } = await admin.auth.admin.listUsers({ page: scanPage, perPage: 100 });
    if (error) {
      return { rows: [], total: 0, error: error.message, searchHint: null };
    }
    const users = data.users ?? [];
    if (users.length === 0) break;
    const profMap = await enrichWithProfiles(admin, users);
    for (const u of users) {
      const prof = profMap.get(u.id);
      if (matchesQuery(u, prof, qLower)) {
        matches.push(toRow(u, prof));
      }
    }
    if (users.length < 100) break;
    if (scanPage === SEARCH_SCAN_MAX_PAGES) {
      searchMayOmitUsers = true;
    }
  }

  matches.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const total = matches.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const pageClamped = Math.min(page, totalPages);
  const start = (pageClamped - 1) * perPage;
  const withLeagueCounts = await enrichWithLeagueCounts(admin, matches.slice(start, start + perPage));
  const rows = await enrichWithDraftPrefCounts(admin, withLeagueCounts);
  const searchHint = searchMayOmitUsers
    ? `Search scanned up to ${SEARCH_SCAN_MAX_PAGES * 100} accounts. Refine the query if you do not see the user.`
    : null;
  return { rows, total, error: null, searchHint };
}

export async function siteAdminGetUserDetail(
  admin: SupabaseClient,
  userId: string
): Promise<{ detail: SiteAdminUserDetail | null; error: string | null }> {
  const { data: userData, error: userErr } = await admin.auth.admin.getUserById(userId);
  if (userErr) return { detail: null, error: userErr.message };
  const u = userData.user;
  if (!u) return { detail: null, error: null };

  let { data: profile, error: profileErr } = await admin
    .from("profiles")
    .select(
      "display_name, avatar_url, timezone, is_site_admin, accepted_terms_at, accepted_privacy_at, is_suspended, suspended_until, suspension_reason, moderation_note, marketing_opt_in, marketing_opt_in_at, last_activity_at"
    )
    .eq("id", userId)
    .maybeSingle();
  if (profileErr && /last_activity_at/i.test(profileErr.message ?? "")) {
    const fallback = await admin
      .from("profiles")
      .select(
        "display_name, avatar_url, timezone, is_site_admin, accepted_terms_at, accepted_privacy_at, is_suspended, suspended_until, suspension_reason, moderation_note, marketing_opt_in, marketing_opt_in_at"
      )
      .eq("id", userId)
      .maybeSingle();
    profileErr = fallback.error;
    const row = fallback.data;
    profile = row
      ? { ...row, last_activity_at: null as string | null }
      : null;
  }
  if (profileErr) return { detail: null, error: profileErr.message };

  let memberships: SiteAdminUserMembership[] = [];
  const { data: memberRows, error: memberErr } = await admin
    .from("league_members")
    .select("league_id, role, joined_at, team_name, manager_catchphrase")
    .eq("user_id", userId)
    .order("joined_at", { ascending: false });

  const memberErrMsg = memberErr?.message.toLowerCase() ?? "";
  if (memberErr && memberErrMsg.includes("manager_catchphrase")) {
    const fallback = await admin
      .from("league_members")
      .select("league_id, role, joined_at, team_name")
      .eq("user_id", userId)
      .order("joined_at", { ascending: false });
    if (fallback.error) return { detail: null, error: fallback.error.message };
    const rows = (fallback.data ??
      []) as { league_id: string; role: string; joined_at: string; team_name: string | null }[];
    const leagueIds = [...new Set(rows.map((r) => r.league_id))];
    const { data: leagues, error: leaguesErr } = await admin.from("leagues").select("id, slug, name").in("id", leagueIds);
    if (leaguesErr) return { detail: null, error: leaguesErr.message };
    const byLeague = new Map<string, { slug: string; name: string }>();
    for (const l of leagues ?? []) byLeague.set(l.id, { slug: l.slug, name: l.name });
    memberships = rows.map((r) => ({
      league_id: r.league_id,
      league_slug: byLeague.get(r.league_id)?.slug ?? r.league_id,
      league_name: byLeague.get(r.league_id)?.name ?? "Unknown league",
      role: r.role,
      joined_at: r.joined_at,
      team_name: r.team_name ?? null,
      manager_catchphrase: null,
    }));
  } else if (memberErr) {
    return { detail: null, error: memberErr.message };
  } else {
    const rows = (memberRows ??
      []) as {
      league_id: string;
      role: string;
      joined_at: string;
      team_name: string | null;
      manager_catchphrase: string | null;
    }[];
    const leagueIds = [...new Set(rows.map((r) => r.league_id))];
    const { data: leagues, error: leaguesErr } = await admin.from("leagues").select("id, slug, name").in("id", leagueIds);
    if (leaguesErr) return { detail: null, error: leaguesErr.message };
    const byLeague = new Map<string, { slug: string; name: string }>();
    for (const l of leagues ?? []) byLeague.set(l.id, { slug: l.slug, name: l.name });
    memberships = rows.map((r) => ({
      league_id: r.league_id,
      league_slug: byLeague.get(r.league_id)?.slug ?? r.league_id,
      league_name: byLeague.get(r.league_id)?.name ?? "Unknown league",
      role: r.role,
      joined_at: r.joined_at,
      team_name: r.team_name ?? null,
      manager_catchphrase: r.manager_catchphrase ?? null,
    }));
  }

  const { data: auditRows } = await admin
    .from("admin_moderation_audit")
    .select("id, action, reason, actor_user_id, created_at")
    .eq("target_user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);
  const { count: draftPrefCount } = await admin
    .from("league_draft_preferences")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  const detail: SiteAdminUserDetail = {
    id: u.id,
    email: u.email ?? null,
    phone: u.phone ?? null,
    display_name: profile?.display_name ?? null,
    avatar_url: profile?.avatar_url ?? null,
    timezone: profile?.timezone ?? null,
    is_site_admin: Boolean(profile?.is_site_admin),
    accepted_terms_at: profile?.accepted_terms_at ?? null,
    accepted_privacy_at: profile?.accepted_privacy_at ?? null,
    is_suspended: Boolean(profile?.is_suspended),
    suspended_until: profile?.suspended_until ?? null,
    suspension_reason: profile?.suspension_reason ?? null,
    moderation_note: profile?.moderation_note ?? null,
    marketing_opt_in: Boolean((profile as { marketing_opt_in?: boolean | null } | null)?.marketing_opt_in),
    marketing_opt_in_at: (profile as { marketing_opt_in_at?: string | null } | null)?.marketing_opt_in_at ?? null,
    draft_pref_count: draftPrefCount ?? 0,
    created_at: u.created_at ?? "",
    last_sign_in_at: u.last_sign_in_at ?? null,
    last_activity_at: (profile as { last_activity_at?: string | null } | null)?.last_activity_at ?? null,
    memberships,
    audit: ((auditRows ?? []) as SiteAdminModerationAuditRow[]),
  };
  return { detail, error: null };
}
