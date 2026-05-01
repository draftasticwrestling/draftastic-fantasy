import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { escapeIlikePattern } from "@/lib/internalAdmin/escapeIlike";

const LEAGUE_LIST_SELECT =
  "id, name, slug, commissioner_id, start_date, end_date, season_slug, draft_date, draft_type, league_type, include_nxt, max_teams, draft_status, created_at, visibility_type, public_status, is_archived, archived_at";

/** When `include_nxt` migration is not applied yet. */
const LEAGUE_LIST_SELECT_NO_INCLUDE_NXT = LEAGUE_LIST_SELECT.replace(", include_nxt", "");

export type SiteAdminLeagueSummary = {
  id: string;
  name: string;
  slug: string;
  commissioner_id: string;
  start_date: string | null;
  end_date: string | null;
  season_slug: string | null;
  draft_date: string | null;
  draft_type: string | null;
  league_type: string | null;
  include_nxt: boolean | null;
  max_teams: number | null;
  draft_status: string | null;
  created_at: string;
  /** `public` | `private`; null treated as private for legacy rows */
  visibility_type: string | null;
  public_status: string | null;
  is_archived: boolean | null;
  archived_at: string | null;
  member_count: number;
  commissioner_display_name: string | null;
};

export type SiteAdminLeagueMember = {
  user_id: string;
  role: string;
  joined_at: string;
  team_name: string | null;
  display_name: string | null;
  active_roster_count: number;
  has_draft_preferences: boolean;
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

async function memberCountsByLeagueId(
  admin: SupabaseClient,
  leagueIds: string[]
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (leagueIds.length === 0) return out;
  const { data, error } = await admin.from("league_members").select("league_id").in("league_id", leagueIds);
  if (error || !data) return out;
  for (const row of data as { league_id: string }[]) {
    const id = row.league_id;
    out.set(id, (out.get(id) ?? 0) + 1);
  }
  return out;
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
  if (error) {
    const isMissingCol =
      error.code === "42703" ||
      /column.*visibility_type|public_status|is_archived|archived_at|include_nxt/i.test(error.message ?? "") ||
      /schema cache/i.test(error.message ?? "");
    if (!isMissingCol) return { rows: [], error: error.message };
    if (/include_nxt/i.test(error.message ?? "")) {
      let qbn = admin
        .from("leagues")
        .select(LEAGUE_LIST_SELECT_NO_INCLUDE_NXT)
        .order("created_at", { ascending: false })
        .limit(40);
      if (q.length > 0) {
        const safe = escapeIlikePattern(q);
        qbn = qbn.or(`slug.ilike.%${safe}%,name.ilike.%${safe}%`);
      }
      const { data: dataN, error: errN } = await qbn;
      if (!errN && dataN) {
        const leaguesN = (dataN ?? []) as unknown as Omit<
          SiteAdminLeagueSummary,
          "commissioner_display_name" | "member_count"
        >[];
        const namesN = await commissionerNamesByIds(
          admin,
          leaguesN.map((l) => l.commissioner_id)
        );
        const countsN = await memberCountsByLeagueId(
          admin,
          leaguesN.map((l) => l.id)
        );
        const rows: SiteAdminLeagueSummary[] = leaguesN.map((l) => ({
          ...l,
          include_nxt: false,
          member_count: countsN.get(l.id) ?? 0,
          commissioner_display_name: namesN.get(l.commissioner_id) ?? null,
        }));
        return { rows };
      }
    }
    let qb2 = admin
      .from("leagues")
      .select(
        "id, name, slug, commissioner_id, start_date, end_date, season_slug, draft_date, league_type, max_teams, draft_status, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(40);
    if (q.length > 0) {
      const safe = escapeIlikePattern(q);
      qb2 = qb2.or(`slug.ilike.%${safe}%,name.ilike.%${safe}%`);
    }
    const { data: data2, error: err2 } = await qb2;
    if (err2) return { rows: [], error: err2.message };
    const leagues2 = (data2 ?? []) as Omit<
      SiteAdminLeagueSummary,
      "commissioner_display_name" | "visibility_type" | "public_status" | "is_archived" | "archived_at" | "member_count"
    >[];
    const names2 = await commissionerNamesByIds(
      admin,
      leagues2.map((l) => l.commissioner_id)
    );
    const counts2 = await memberCountsByLeagueId(
      admin,
      leagues2.map((l) => l.id)
    );
    const rows: SiteAdminLeagueSummary[] = leagues2.map((l) => ({
      ...l,
      draft_type: null,
      include_nxt: false,
      visibility_type: "private",
      public_status: null,
      is_archived: false,
      archived_at: null,
      member_count: counts2.get(l.id) ?? 0,
      commissioner_display_name: names2.get(l.commissioner_id) ?? null,
    }));
    return { rows };
  }
  const leagues = (data ?? []) as Omit<SiteAdminLeagueSummary, "commissioner_display_name" | "member_count">[];
  const names = await commissionerNamesByIds(
    admin,
    leagues.map((l) => l.commissioner_id)
  );
  const counts = await memberCountsByLeagueId(
    admin,
    leagues.map((l) => l.id)
  );
  const rows: SiteAdminLeagueSummary[] = leagues.map((l) => ({
    ...l,
    member_count: counts.get(l.id) ?? 0,
    commissioner_display_name: names.get(l.commissioner_id) ?? null,
  }));
  return { rows };
}

const LEAGUE_DETAIL_SELECT_LEGACY =
  "id, name, slug, commissioner_id, start_date, end_date, season_slug, draft_date, league_type, max_teams, draft_status, created_at";

export async function siteAdminGetLeagueBySlug(
  admin: SupabaseClient,
  slug: string
): Promise<{ detail: SiteAdminLeagueDetail | null; error?: string }> {
  let leagueRes = await admin.from("leagues").select(LEAGUE_LIST_SELECT).eq("slug", slug).maybeSingle();
  let league = leagueRes.data;
  let leagueErr = leagueRes.error;

  if (leagueErr && /include_nxt/i.test(leagueErr.message ?? "")) {
    const retryNxt = await admin.from("leagues").select(LEAGUE_LIST_SELECT_NO_INCLUDE_NXT).eq("slug", slug).maybeSingle();
    const row = retryNxt.data;
    if (!retryNxt.error && row && typeof row === "object" && !Array.isArray(row)) {
      league = { ...(row as Record<string, unknown>), include_nxt: false } as typeof league;
      leagueErr = null;
    } else {
      league = row as typeof league;
      leagueErr = retryNxt.error;
    }
  }

  if (leagueErr) {
    const isMissingCol =
      leagueErr.code === "42703" ||
      /column.*visibility_type|public_status|is_archived|archived_at/i.test(leagueErr.message ?? "") ||
      /schema cache/i.test(leagueErr.message ?? "");
    if (!isMissingCol) return { detail: null, error: leagueErr.message };
    const retry = await admin.from("leagues").select(LEAGUE_DETAIL_SELECT_LEGACY).eq("slug", slug).maybeSingle();
    league = retry.data as typeof league;
    leagueErr = retry.error;
    if (league && !leagueErr) {
      league = {
        ...league,
        draft_type: null,
        include_nxt: false,
        visibility_type: "private",
        public_status: null,
        is_archived: false,
        archived_at: null,
      } as typeof league;
    }
  }

  if (leagueErr) return { detail: null, error: leagueErr.message };
  if (!league) return { detail: null };

  const L = league as Omit<SiteAdminLeagueSummary, "commissioner_display_name" | "member_count"> & {
    visibility_type?: string | null;
    public_status?: string | null;
    is_archived?: boolean | null;
    archived_at?: string | null;
  };
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
  const { data: prefRows } = await admin
    .from("league_draft_preferences")
    .select("user_id")
    .eq("league_id", L.id);
  const prefUsers = new Set(((prefRows ?? []) as { user_id: string }[]).map((r) => r.user_id));

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
    has_draft_preferences: prefUsers.has(m.user_id),
  }));

  const visibility_type = L.visibility_type ?? "private";
  const public_status = L.public_status ?? null;
  const is_archived = Boolean(L.is_archived ?? false);
  const archived_at = L.archived_at ?? null;

  return {
    detail: {
      league: {
        ...L,
        visibility_type,
        public_status,
        is_archived,
        archived_at,
        member_count: memberRows.length,
        commissioner_display_name,
      },
      members: membersOut,
    },
  };
}
