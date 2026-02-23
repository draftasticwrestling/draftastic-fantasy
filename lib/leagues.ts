import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { getRosterRulesForLeague } from "@/lib/leagueStructure";
import { getDefaultStartEndForSeason } from "@/lib/leagueSeasons";
import { aggregateWrestlerPoints, getPointsForSingleEvent } from "@/lib/scoring/aggregateWrestlerPoints.js";

export type League = {
  id: string;
  name: string;
  slug: string;
  commissioner_id: string;
  start_date: string | null;
  end_date: string | null;
  season_slug?: string | null;
  draft_date?: string | null;
  league_type?: string | null;
  max_teams?: number | null;
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
  team_name?: string | null;
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
  league_type?: string | null;
  max_teams?: number | null;
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
  const league_type = params.league_type?.trim() || null;
  const max_teams =
    params.max_teams != null && Number.isFinite(Number(params.max_teams))
      ? Math.min(12, Math.max(3, Math.floor(Number(params.max_teams))))
      : null;

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
      league_type,
      max_teams,
    })
    .select("id, name, slug, commissioner_id, start_date, end_date, season_slug, draft_date, league_type, max_teams, created_at")
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

  const fullSelect = "id, name, slug, commissioner_id, start_date, end_date, season_slug, draft_date, league_type, max_teams, draft_style, draft_status, draft_current_pick, created_at";
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
    .select("id, league_id, user_id, role, joined_at, team_name")
    .eq("league_id", leagueId)
    .order("joined_at", { ascending: true });

  if (error) {
    const fallback = await supabase
      .from("league_members")
      .select("id, league_id, user_id, role, joined_at")
      .eq("league_id", leagueId)
      .order("joined_at", { ascending: true });
    if (fallback.error || !fallback.data?.length) return [];
    const rows2 = fallback.data as { id: string; league_id: string; user_id: string; role: string; joined_at: string }[];
    const userIds = [...new Set(rows2.map((r) => r.user_id))];
    const { data: profiles } = await supabase.from("profiles").select("id, display_name").in("id", userIds);
    const nameByUserId = Object.fromEntries((profiles ?? []).map((p) => [p.id, p.display_name]));
    return rows2.map((r) => ({
      ...r,
      display_name: nameByUserId[r.user_id] ?? null,
      team_name: null,
    })) as LeagueMember[];
  }

  const rowsList = (rows ?? []) as { id: string; league_id: string; user_id: string; role: string; joined_at: string; team_name?: string | null }[];
  if (!rowsList.length) return [];

  const userIds = [...new Set(rowsList.map((r) => r.user_id))];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", userIds);

  const nameByUserId = Object.fromEntries(
    (profiles ?? []).map((p) => [p.id, p.display_name])
  );

  return rowsList.map((r) => ({
    ...r,
    display_name: nameByUserId[r.user_id] ?? null,
    team_name: r.team_name ?? null,
  })) as LeagueMember[];
}

/**
 * Update the current user's team name for a league. Only the member themselves can update.
 */
export async function updateLeagueMemberTeamName(
  leagueId: string,
  teamName: string | null
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("league_members")
    .update({ team_name: teamName?.trim() || null })
    .eq("league_id", leagueId)
    .eq("user_id", user.id);

  return error ? { error: error.message } : {};
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

/** Stint for scoring: points count when event_date >= acquired_at and (released_at is null or event_date <= released_at). */
export type LeagueRosterStint = {
  user_id: string;
  wrestler_id: string;
  contract: string | null;
  acquired_at: string; // YYYY-MM-DD
  released_at: string | null; // YYYY-MM-DD
};

/**
 * Get current roster entries for a league (released_at IS NULL), keyed by user_id.
 */
export async function getRostersForLeague(
  leagueId: string
): Promise<Record<string, LeagueRosterEntry[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("league_rosters")
    .select("user_id, wrestler_id, contract")
    .eq("league_id", leagueId)
    .is("released_at", null)
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

/**
 * Get all roster stints for a league (active and released) for acquisition-window scoring.
 */
export async function getRosterStintsForLeague(
  leagueId: string
): Promise<LeagueRosterStint[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("league_rosters")
    .select("user_id, wrestler_id, contract, acquired_at, released_at")
    .eq("league_id", leagueId)
    .order("acquired_at", { ascending: true });

  if (error) return [];
  const rows = (data ?? []) as {
    user_id: string;
    wrestler_id: string;
    contract: string | null;
    acquired_at: string;
    released_at: string | null;
  }[];
  return rows.map((r) => ({
    user_id: r.user_id,
    wrestler_id: r.wrestler_id,
    contract: r.contract,
    acquired_at: String(r.acquired_at ?? "").slice(0, 10),
    released_at: r.released_at ? String(r.released_at).slice(0, 10) : null,
  }));
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
 * acquiredAt: first date owner gets points (YYYY-MM-DD); default today.
 * By default uses RLS (commissioner only). Pass useServiceRole: true for draft picks.
 */
export async function addWrestlerToRoster(
  leagueId: string,
  userId: string,
  wrestlerId: string,
  contract?: string | null,
  useServiceRole?: boolean,
  acquiredAt?: string | null
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
      .eq("user_id", userId)
      .is("released_at", null);
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
  const acquiredDate =
    (acquiredAt && /^\d{4}-\d{2}-\d{2}$/.test(acquiredAt.trim()) ? acquiredAt.trim() : null) ||
    new Date().toISOString().slice(0, 10);
  const { error } = await insertClient.from("league_rosters").insert({
    league_id: leagueId,
    user_id: userId,
    wrestler_id: wid,
    contract: contract?.trim() || null,
    acquired_at: acquiredDate,
    released_at: null,
  });

  if (error) return { error: error.message };
  return {};
}

/**
 * Remove a wrestler from a member's roster (set released_at = today so points before today still count).
 * Commissioner only (RLS enforced).
 */
export async function removeWrestlerFromRoster(
  leagueId: string,
  userId: string,
  wrestlerId: string,
  releasedAt?: string | null
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const releasedDate =
    (releasedAt && /^\d{4}-\d{2}-\d{2}$/.test(releasedAt.trim()) ? releasedAt.trim() : null) ||
    new Date().toISOString().slice(0, 10);

  const { data: updated, error } = await supabase
    .from("league_rosters")
    .update({ released_at: releasedDate })
    .eq("league_id", leagueId)
    .eq("user_id", userId)
    .eq("wrestler_id", String(wrestlerId).trim())
    .is("released_at", null)
    .select("id")
    .maybeSingle();

  if (error) return { error: error.message };
  if (!updated) return { error: "Wrestler not on roster or already released." };
  return {};
}

export type PointsBySlug = Record<string, { rsPoints: number; plePoints: number; beltPoints: number }>;

/**
 * Load events in league date range and return points per wrestler slug and per owner.
 * Owner points use acquisition/release windows: only count event points when
 * event_date >= stint.acquired_at and (stint.released_at is null or event_date <= stint.released_at).
 */
export async function getLeagueScoring(
  leagueId: string
): Promise<{
  pointsBySlug: PointsBySlug;
  pointsByOwner: Record<string, number>;
  pointsByOwnerByWrestler: Record<string, Record<string, number>>;
}> {
  const supabase = await createClient();
  const { data: league } = await supabase
    .from("leagues")
    .select("id, start_date, end_date, draft_date")
    .eq("id", leagueId)
    .single();

  const empty = { pointsBySlug: {}, pointsByOwner: {}, pointsByOwnerByWrestler: {} };
  if (!league) return empty;

  const start = (league.draft_date || league.start_date) ?? "";
  const end = league.end_date ?? "";
  if (!start && !end) return empty;

  const { data: events } = await supabase
    .from("events")
    .select("id, name, date, matches")
    .eq("status", "completed")
    .order("date", { ascending: true });

  const filtered = (events ?? []).filter((e) => {
    const d = (e.date ?? "").toString().slice(0, 10);
    if (start && d < start) return false;
    if (end && d > end) return false;
    return true;
  });

  const pointsBySlug = aggregateWrestlerPoints(filtered) as PointsBySlug;
  const stints = await getRosterStintsForLeague(leagueId);
  const pointsByOwner: Record<string, number> = {};
  /** Per owner, points from each wrestler (only while on roster). For team page per-wrestler breakdown. */
  const pointsByOwnerByWrestler: Record<string, Record<string, number>> = {};
  let kotrCarryOver: Record<string, number> = {};
  const sortedEvents = [...filtered].sort((a, b) =>
    String(a.date ?? "").localeCompare(String(b.date ?? ""))
  );
  for (const event of sortedEvents) {
    const eventDate = (event.date ?? "").toString().slice(0, 10);
    const { pointsBySlug: eventPoints, updatedCarryOver } = getPointsForSingleEvent(
      event,
      kotrCarryOver
    );
    kotrCarryOver = updatedCarryOver;
    for (const stint of stints) {
      if (eventDate < stint.acquired_at) continue;
      if (stint.released_at != null && eventDate > stint.released_at) continue;
      const pts = eventPoints[stint.wrestler_id] ?? 0;
      pointsByOwner[stint.user_id] = (pointsByOwner[stint.user_id] ?? 0) + pts;
      if (pts > 0) {
        if (!pointsByOwnerByWrestler[stint.user_id]) pointsByOwnerByWrestler[stint.user_id] = {};
        pointsByOwnerByWrestler[stint.user_id][stint.wrestler_id] =
          (pointsByOwnerByWrestler[stint.user_id][stint.wrestler_id] ?? 0) + pts;
      }
    }
  }
  return { pointsBySlug, pointsByOwner, pointsByOwnerByWrestler };
}

/**
 * Compute total fantasy points per owner for a league. Uses league start/end and draft_date
 * (points from first event on or after draft_date). Returns a map of user_id -> total points.
 */
export async function getPointsByOwnerForLeague(
  leagueId: string
): Promise<Record<string, number>> {
  const { pointsByOwner } = await getLeagueScoring(leagueId);
  return pointsByOwner;
}
