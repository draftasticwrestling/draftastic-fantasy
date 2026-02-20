import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { getRosterRulesForLeague } from "@/lib/leagueStructure";
import { getDefaultStartEndForSeason } from "@/lib/leagueSeasons";

export type League = {
  id: string;
  name: string;
  slug: string;
  commissioner_id: string;
  start_date: string | null;
  end_date: string | null;
  season_slug?: string | null;
  draft_date?: string | null;
  draft_style?: "snake" | "linear";
  draft_status?: "not_started" | "in_progress" | "completed";
  draft_current_pick?: number | null;
  created_at: string;
};

export type LeagueMember = {
  id: string;
  league_id: string;
  user_id: string;
  role: "commissioner" | "owner";
  joined_at: string;
  display_name?: string | null;
};

export type LeagueWithRole = League & { role: "commissioner" | "owner" };

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "league";
}

function makeSlugUnique(base: string, existingSlugs: Set<string>): string {
  let slug = base;
  let n = 0;
  while (existingSlugs.has(slug)) {
    n += 1;
    slug = `${base}-${n}`;
  }
  return slug;
}

/**
 * Create a new league. Caller must be authenticated; they become commissioner.
 * When season_slug and season_year are provided, start_date and end_date are derived from the season.
 */
export async function createLeague(params: {
  name: string;
  season_slug: string;
  season_year: number;
  draft_date?: string | null;
  start_date?: string | null;
  end_date?: string | null;
}): Promise<{ league?: League; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const name = params.name?.trim();
  if (!name) return { error: "League name is required" };

  const seasonSlug = params.season_slug?.trim();
  if (!seasonSlug) return { error: "Select a season." };

  const year = Math.floor(Number(params.season_year));
  if (!Number.isFinite(year) || year < 2020 || year > 2030) {
    return { error: "Select a valid season year." };
  }

  const window = getDefaultStartEndForSeason(seasonSlug, year);
  if (!window) return { error: "Invalid season." };

  const baseSlug = slugify(name);
  const admin = getAdminClient();
  if (!admin) {
    return {
      error:
        "Server configuration: SUPABASE_SERVICE_ROLE_KEY is not set. Add it in Netlify → Site settings → Environment variables (from Supabase Dashboard → Settings → API → service_role).",
    };
  }
  const { data: existing } = await admin.from("leagues").select("slug");
  const existingSlugs = new Set((existing ?? []).map((r) => r.slug));
  const slug = makeSlugUnique(baseSlug, existingSlugs);

  const draft_date = params.draft_date?.trim() || null;

  const { data: league, error } = await admin
    .from("leagues")
    .insert({
      name,
      slug,
      commissioner_id: user.id,
      start_date: window.start_date,
      end_date: window.end_date,
      season_slug: seasonSlug,
      draft_date,
    })
    .select("id, name, slug, commissioner_id, start_date, end_date, season_slug, draft_date, created_at")
    .single();

  if (error) return { error: error.message };
  if (!league) return { error: "Failed to create league" };

  await admin.from("league_members").insert({
    league_id: league.id,
    user_id: user.id,
    role: "commissioner",
  });

  return { league: league as League };
}

/**
 * Get a league by slug. Returns null if not found or user is not a member.
 * If draft columns are missing (migration not run), returns league with default draft fields.
 */
export async function getLeagueBySlug(slug: string): Promise<(League & { role: "commissioner" | "owner" }) | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const fullSelect = "id, name, slug, commissioner_id, start_date, end_date, season_slug, draft_date, draft_style, draft_status, draft_current_pick, created_at";
  let result = await supabase
    .from("leagues")
    .select(fullSelect)
    .eq("slug", slug)
    .maybeSingle();

  let league = result.data;
  const isColumnError =
    result.error &&
    (result.error.code === "42703" ||
      /column|relation.*does not exist/i.test(result.error.message ?? ""));
  if (isColumnError) {
    const minimalResult = await supabase
      .from("leagues")
      .select("id, name, slug, commissioner_id, start_date, end_date, season_slug, draft_date, created_at")
      .eq("slug", slug)
      .maybeSingle();
    if (minimalResult.data) {
      league = {
        ...minimalResult.data,
        draft_style: "snake",
        draft_status: "not_started",
        draft_current_pick: null,
      } as typeof league;
    } else {
      league = minimalResult.data;
    }
  }

  if (result.error && !league) return null;
  if (!league) return null;

  const { data: member } = await supabase
    .from("league_members")
    .select("role")
    .eq("league_id", league.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!member) return null;
  return { ...league, role: member.role } as League & { role: "commissioner" | "owner" };
}

/**
 * List leagues the current user is a member of.
 */
export async function getLeaguesForUser(): Promise<LeagueWithRole[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: members, error: meError } = await supabase
    .from("league_members")
    .select("league_id, role")
    .eq("user_id", user.id);

  if (meError || !members?.length) return [];

  const leagueIds = members.map((m) => m.league_id);
  const { data: leagues, error: leagueError } = await supabase
    .from("leagues")
    .select("id, name, slug, commissioner_id, start_date, end_date, season_slug, draft_date, draft_style, draft_status, draft_current_pick, created_at")
    .in("id", leagueIds);

  if (leagueError || !leagues?.length) return [];

  const roleByLeagueId = Object.fromEntries(members.map((m) => [m.league_id, m.role]));
  return leagues.map((l) => ({
    ...l,
    role: roleByLeagueId[l.id] ?? "owner",
  })) as LeagueWithRole[];
}

/**
 * Get members of a league with display names. Caller must be a member.
 */
export async function getLeagueMembers(leagueId: string): Promise<LeagueMember[]> {
  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("league_members")
    .select("id, league_id, user_id, role, joined_at")
    .eq("league_id", leagueId)
    .order("joined_at", { ascending: true });

  if (error || !rows?.length) return [];

  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", userIds);

  const nameByUserId = Object.fromEntries(
    (profiles ?? []).map((p) => [p.id, p.display_name])
  );

  return rows.map((r) => ({
    ...r,
    display_name: nameByUserId[r.user_id] ?? null,
  })) as LeagueMember[];
}

/**
 * Create an invite for a league. Returns the full join URL and token. Commissioner only.
 */
export async function createLeagueInvite(
  leagueId: string,
  expiresInDays: number = 7
): Promise<{ url: string; token: string; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { url: "", token: "", error: "Not authenticated" };

  const { data: league } = await supabase
    .from("leagues")
    .select("id, commissioner_id, slug")
    .eq("id", leagueId)
    .single();

  if (!league || league.commissioner_id !== user.id) {
    return { url: "", token: "", error: "Not the commissioner" };
  }

  const token = crypto.randomUUID().replace(/-/g, "").slice(0, 24);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);

  const { error } = await supabase.from("league_invites").insert({
    league_id: leagueId,
    token,
    created_by: user.id,
    expires_at: expiresAt.toISOString(),
  });

  if (error) return { url: "", token: "", error: error.message };

  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const url = `${base}/leagues/join?token=${token}`;
  return { url, token };
}

/**
 * Join a league using an invite token. Uses the Supabase RPC.
 */
export async function joinLeagueWithToken(token: string): Promise<{
  ok: boolean;
  league_slug?: string;
  error?: string;
  message?: string;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("join_league_with_token", {
    p_token: token.trim(),
  });

  if (error) return { ok: false, error: error.message };
  const result = data as { ok: boolean; league_slug?: string; error?: string; message?: string };
  return result;
}

// --- Commissioner manual rosters (league_rosters) ---

export type LeagueRosterEntry = { wrestler_id: string; contract: string | null };

/**
 * Get all roster entries for a league, keyed by user_id. Caller must be a league member.
 */
export async function getRostersForLeague(
  leagueId: string
): Promise<Record<string, LeagueRosterEntry[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("league_rosters")
    .select("user_id, wrestler_id, contract")
    .eq("league_id", leagueId)
    .order("created_at", { ascending: true });

  if (error) return {};
  const rows = (data ?? []) as { user_id: string; wrestler_id: string; contract: string | null }[];
  const byUser: Record<string, LeagueRosterEntry[]> = {};
  for (const r of rows) {
    if (!byUser[r.user_id]) byUser[r.user_id] = [];
    byUser[r.user_id].push({ wrestler_id: r.wrestler_id, contract: r.contract });
  }
  return byUser;
}

/** Normalize wrestler gender to F/M for roster rules. */
function normalizeWrestlerGender(g: string | null | undefined): "F" | "M" | null {
  if (g == null || typeof g !== "string") return null;
  const lower = g.trim().toLowerCase();
  if (lower === "female" || lower === "f") return "F";
  if (lower === "male" || lower === "m") return "M";
  return null;
}

/**
 * Add a wrestler to a member's roster.
 * Validates roster size and gender minimums (when league has 3–12 teams).
 * By default uses RLS (commissioner only). Pass useServiceRole: true for draft picks so the current picker can add to their own roster.
 */
export async function addWrestlerToRoster(
  leagueId: string,
  userId: string,
  wrestlerId: string,
  contract?: string | null,
  useServiceRole?: boolean
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const wid = String(wrestlerId).trim();
  if (!wid) return { error: "Wrestler is required" };

  const memberCountResult = await supabase
    .from("league_members")
    .select("id")
    .eq("league_id", leagueId);
  const teamCount = (memberCountResult.data ?? []).length;
  const rules = getRosterRulesForLeague(teamCount);

  if (rules) {
    const { data: currentRows } = await supabase
      .from("league_rosters")
      .select("wrestler_id")
      .eq("league_id", leagueId)
      .eq("user_id", userId);
    const currentIds = (currentRows ?? []).map((r) => r.wrestler_id);
    if (currentIds.includes(wid)) return { error: "That wrestler is already on this roster." };
    if (currentIds.length >= rules.rosterSize) {
      return { error: `Roster full (max ${rules.rosterSize} wrestlers).` };
    }

    const wrestlerIdsToFetch = [...new Set([...currentIds, wid])];
    const { data: wrestlerRows } = await supabase
      .from("wrestlers")
      .select("id, gender")
      .in("id", wrestlerIdsToFetch);
    const genderById: Record<string, "F" | "M" | null> = {};
    for (const w of wrestlerRows ?? []) {
      genderById[w.id] = normalizeWrestlerGender(w.gender);
    }
    let currentFemale = 0;
    let currentMale = 0;
    for (const id of currentIds) {
      const g = genderById[id];
      if (g === "F") currentFemale++;
      else if (g === "M") currentMale++;
    }
    const newWrestlerGender = genderById[wid];
    const newFemale = currentFemale + (newWrestlerGender === "F" ? 1 : 0);
    const newMale = currentMale + (newWrestlerGender === "M" ? 1 : 0);
    const newCount = currentIds.length + 1;

    if (newCount === rules.rosterSize && (newFemale < rules.minFemale || newMale < rules.minMale)) {
      return {
        error: `Roster must have at least ${rules.minFemale} female and ${rules.minMale} male wrestlers when full. Current would be ${newFemale}F / ${newMale}M.`,
      };
    }
  }

  const admin = getAdminClient();
  if (useServiceRole && !admin) {
    return { error: "Server misconfiguration: SUPABASE_SERVICE_ROLE_KEY is not set. Draft picks need this. Add it in .env and Netlify environment variables." };
  }
  const insertClient = useServiceRole && admin ? admin : supabase;
  const { error } = await insertClient.from("league_rosters").insert({
    league_id: leagueId,
    user_id: userId,
    wrestler_id: wid,
    contract: contract?.trim() || null,
  });

  if (error) return { error: error.message };
  return {};
}

/**
 * Remove a wrestler from a member's roster. Commissioner only (RLS enforced).
 */
export async function removeWrestlerFromRoster(
  leagueId: string,
  userId: string,
  wrestlerId: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("league_rosters")
    .delete()
    .eq("league_id", leagueId)
    .eq("user_id", userId)
    .eq("wrestler_id", String(wrestlerId).trim());

  if (error) return { error: error.message };
  return {};
}
