import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { escapeIlikePattern } from "@/lib/internalAdmin/escapeIlike";

const LEAGUE_LIST_SELECT =
  "id, name, slug, commissioner_id, start_date, end_date, season_slug, draft_date, league_type, max_teams, created_at";

export type SiteAdminLeagueSummary = {
  id: string;
  name: string;
  slug: string;
  commissioner_id: string;
  start_date: string | null;
  end_date: string | null;
  season_slug: string | null;
  draft_date: string | null;
  league_type: string | null;
  max_teams: number | null;
  created_at: string;
  commissioner_display_name: string | null;
};

export type SiteAdminLeagueMember = {
  user_id: string;
  role: string;
  joined_at: string;
  team_name: string | null;
  display_name: string | null;
  active_roster_count: number;
};

export type SiteAdminLeagueDetail = {
  league: Omit<SiteAdminLeagueSummary, "commissioner_display_name"> & {
    commissioner_display_name: string | null;
  };
  members: SiteAdminLeagueMember[];
};

async function commissionerNamesByIds(
  admin: SupabaseClient,
  ids: string[]
): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>();
  if (ids.length === 0) return map;
  const { data, error } = await admin
    .from("profiles")
    .select("id, display_name")
    .in("id", [...new Set(ids)]);
  if (error || !data) return map;
  for (const row of data as { id: string; display_name: string | null }[]) {
    map.set(row.id, row.display_name ?? null);
  }
  return map;
}

/**
 * Search leagues by slug or name (substring, case-insensitive). Empty query returns recent leagues.
 */
export async function siteAdminSearchLeagues(
  admin: SupabaseClient,
  query: string
): Promise<{ rows: SiteAdminLeagueSummary[]; error?: string }> {
  const q = query.trim();
  let qb = admin.from("leagues").select(LEAGUE_LIST_SELECT).order("created_at", { ascending: false }).limit(40);

  if (q.length > 0) {
    const safe = escapeIlikePattern(q);
    qb = qb.or(`slug.ilike.%${safe}%,name.ilike.%${safe}%`);
  }

  const { data, error } = await qb;
  if (error) return { rows: [], error: error.message };
  const leagues = (data ?? []) as Omit<SiteAdminLeagueSummary, "commissioner_display_name">[];
  const names = await commissionerNamesByIds(
    admin,
    leagues.map((l) => l.commissioner_id)
  );
  const rows: SiteAdminLeagueSummary[] = leagues.map((l) => ({
    ...l,
    commissioner_display_name: names.get(l.commissioner_id) ?? null,
  }));
  return { rows };
}

export async function siteAdminGetLeagueBySlug(
  admin: SupabaseClient,
  slug: string
): Promise<{ detail: SiteAdminLeagueDetail | null; error?: string }> {
  const { data: league, error: leagueErr } = await admin
    .from("leagues")
    .select(LEAGUE_LIST_SELECT)
    .eq("slug", slug)
    .maybeSingle();

  if (leagueErr) return { detail: null, error: leagueErr.message };
  if (!league) return { detail: null };

  const L = league as Omit<SiteAdminLeagueSummary, "commissioner_display_name">;
  const commMap = await commissionerNamesByIds(admin, [L.commissioner_id]);
  const commissioner_display_name = commMap.get(L.commissioner_id) ?? null;

  const { data: members, error: memErr } = await admin
    .from("league_members")
    .select("user_id, role, joined_at, team_name")
    .eq("league_id", L.id)
    .order("joined_at", { ascending: true });

  if (memErr) return { detail: null, error: memErr.message };

  const memberRows = (members ?? []) as {
    user_id: string;
    role: string;
    joined_at: string;
    team_name: string | null;
  }[];

  const userIds = memberRows.map((m) => m.user_id);
  const profMap = await commissionerNamesByIds(admin, userIds);

  const { data: rosterRows, error: rosterErr } = await admin
    .from("league_rosters")
    .select("user_id, released_at")
    .eq("league_id", L.id);

  const activeByUser = new Map<string, number>();
  if (!rosterErr && rosterRows) {
    for (const r of rosterRows as { user_id: string; released_at: string | null }[]) {
      if (r.released_at != null) continue;
      activeByUser.set(r.user_id, (activeByUser.get(r.user_id) ?? 0) + 1);
    }
  }

  const membersOut: SiteAdminLeagueMember[] = memberRows.map((m) => ({
    user_id: m.user_id,
    role: m.role,
    joined_at: m.joined_at,
    team_name: m.team_name ?? null,
    display_name: profMap.get(m.user_id) ?? null,
    active_roster_count: activeByUser.get(m.user_id) ?? 0,
  }));

  return {
    detail: {
      league: { ...L, commissioner_display_name },
      members: membersOut,
    },
  };
}
