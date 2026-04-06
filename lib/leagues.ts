import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { getRosterRulesForLeagueId } from "@/lib/leagueStructure";
import { getDefaultStartEndForSeason } from "@/lib/leagueSeasons";
import { aggregateWrestlerPoints, getPointsForSingleEvent } from "@/lib/scoring/aggregateWrestlerPoints.js";
import { eventPointsForRosterStint, sumMonthlyBeltPointsForStint } from "@/lib/scoring/rosterStintEventPoints";
import {
  BELT_REIGN_INFERENCE_EVENTS_FROM,
  computeEndOfMonthBeltPointsForSingleMonth,
  firstMonthEndOnOrAfter,
  getCompletedMonthEndsForBeltScoring,
  inferReignsFromEvents,
  mergeReigns,
} from "@/lib/scoring/endOfMonthBeltPoints.js";
import {
  compareStintsForEventTieBreak,
  rosterStintActiveForEvent,
  rosterStintActiveForMonthEndBelt,
} from "@/lib/scoring/rosterStintEventWindow";
import { timestamptzForAcquiredAtDate, timestamptzForReleasedAtDate } from "@/lib/rosterTimestamps";
import { validateFactionNameForSave } from "@/lib/factionName";
import { validateManagerCatchphraseForSave } from "@/lib/managerCatchphrase";
import { validateFactionEmojiForSave } from "@/lib/factionEmoji";
import { isLeagueManagerAvatarUrl } from "@/lib/managerAvatarBucket";
import {
  CHAMPIONSHIP_CHANGES_TABLE_NAME,
  inferReignsFromChampionshipChanges,
} from "@/lib/championshipCurrentFromChanges";
import {
  beltScoringLastMonthEndInclusive,
  isRoadToSummerSlam2026WithSummerslamFinale,
  transformRts2026BeltMonthEnds,
} from "@/lib/beltRts2026JulyDeferral";
import { generateJoinCode, INVITE_LINK_EXPIRY_DAYS } from "@/lib/leagueJoinCode";

export type DraftType = "offline" | "linear" | "snake" | "autopick";
export type DraftOrderMethod = "random_one_hour_before" | "manual_by_gm";

export type League = {
  id: string;
  name: string;
  slug: string;
  commissioner_id: string;
  start_date: string | null;
  end_date: string | null;
  season_slug?: string | null;
  draft_date?: string | null;
  draft_time?: string | null;
  league_type?: string | null;
  max_teams?: number | null;
  auto_reactivate?: boolean | null;
  draft_style?: "snake" | "linear";
  draft_type?: DraftType | null;
  time_per_pick_seconds?: number | null;
  draft_order_method?: DraftOrderMethod | null;
  draft_status?: "not_started" | "in_progress" | "completed";
  draft_current_pick?: number | null;
  manager_note?: string | null;
  /** Permanent join code (XXXX-XXXX); does not expire. */
  join_code?: string | null;
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
  /** Legacy; UI uses profiles.avatar_url for faction image. */
  faction_emoji?: string | null;
  /** Per-league override; when null, UI uses profiles.avatar_url. */
  manager_avatar_url?: string | null;
  /** Optional tagline unique per league (case-insensitive) among members. */
  manager_catchphrase?: string | null;
  /** From profiles — default manager avatar when manager_avatar_url is null. */
  avatar_url?: string | null;
};

export type LeagueWithRole = League & { role: "commissioner" | "owner" };

/**
 * Date (YYYY-MM-DD) from which the league counts points. Matches getLeagueScoring so that
 * League Leaders, roster tables, and standings all use the same event window: when
 * draft_date is set we use it (so events on draft day count); otherwise start_date ??
 * draft_date ?? created_at. This ensures wrestler points show on rosters and League
 * Leaders when team totals show in standings.
 */
export function getEffectiveLeagueStartDate(league: {
  start_date: string | null;
  draft_date?: string | null;
  created_at?: string;
}): string {
  const draft = league.draft_date ? league.draft_date.slice(0, 10) : null;
  const start = league.start_date ? league.start_date.slice(0, 10) : null;
  const created = league.created_at ? league.created_at.slice(0, 10) : null;
  const raw =
    draft ||
    start ||
    created ||
    "2025-05-02";
  return raw;
}

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
 * If season_year is missing or out of range, the current calendar year is used.
 */
export async function createLeague(params: {
  name: string;
  season_slug: string;
  season_year?: number | null;
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

  const yearParsed = Math.floor(Number(params.season_year));
  const year =
    Number.isFinite(yearParsed) && yearParsed >= 2020 && yearParsed <= 2030
      ? yearParsed
      : new Date().getFullYear();

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
      ? Math.min(16, Math.max(3, Math.floor(Number(params.max_teams))))
      : null;

  const leagueSelect =
    "id, name, slug, commissioner_id, start_date, end_date, season_slug, draft_date, league_type, max_teams, join_code, created_at";

  let league: League | null = null;
  let createError: string | undefined;
  for (let attempt = 0; attempt < 30; attempt++) {
    const join_code = generateJoinCode();
    const result = await admin
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
        join_code,
      })
      .select(leagueSelect)
      .single();

    if (!result.error && result.data) {
      league = result.data as League;
      break;
    }
    const msg = result.error?.message ?? "";
    const code = (result.error as { code?: string })?.code;
    if (code === "23505" && msg.includes("join_code")) {
      continue;
    }
    createError = msg || "Failed to create league";
    break;
  }

  if (createError) return { error: createError };
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

  const fullSelect =
    "id, name, slug, commissioner_id, start_date, end_date, season_slug, draft_date, draft_time, league_type, max_teams, join_code, auto_reactivate, draft_style, draft_type, time_per_pick_seconds, draft_order_method, draft_status, draft_current_pick, manager_note, created_at";
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
        draft_time: null,
        draft_style: "snake",
        draft_type: "snake",
        time_per_pick_seconds: 120,
        draft_order_method: "random_one_hour_before",
        draft_status: "not_started",
        draft_current_pick: null,
        auto_reactivate: false,
        manager_note: null,
        join_code: null,
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
    .select("id, name, slug, commissioner_id, start_date, end_date, season_slug, draft_date, draft_style, draft_status, draft_current_pick, league_type, created_at")
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
  type Row = {
    id: string;
    league_id: string;
    user_id: string;
    role: string;
    joined_at: string;
    team_name?: string | null;
    faction_emoji?: string | null;
    manager_avatar_url?: string | null;
    manager_catchphrase?: string | null;
  };

  let cols = [
    "id",
    "league_id",
    "user_id",
    "role",
    "joined_at",
    "team_name",
    "faction_emoji",
    "manager_avatar_url",
    "manager_catchphrase",
  ];
  let full = await supabase.from("league_members").select(cols.join(", ")).eq("league_id", leagueId).order("joined_at", {
    ascending: true,
  });
  for (let attempt = 0; attempt < 4 && full.error; attempt++) {
    const msg = full.error.message ?? "";
    if (msg.includes("manager_catchphrase")) {
      cols = cols.filter((c) => c !== "manager_catchphrase");
    } else if (msg.includes("manager_avatar")) {
      cols = cols.filter((c) => c !== "manager_avatar_url");
    } else {
      break;
    }
    full = await supabase.from("league_members").select(cols.join(", ")).eq("league_id", leagueId).order("joined_at", {
      ascending: true,
    });
  }

  let rowsList: Row[];

  if (full.error) {
    const msg = full.error.message ?? "";
    if (msg.includes("faction_emoji")) {
      const partial = await supabase
        .from("league_members")
        .select("id, league_id, user_id, role, joined_at, team_name")
        .eq("league_id", leagueId)
        .order("joined_at", { ascending: true });
      if (partial.error) {
        const minimal = await supabase
          .from("league_members")
          .select("id, league_id, user_id, role, joined_at")
          .eq("league_id", leagueId)
          .order("joined_at", { ascending: true });
        if (minimal.error || !minimal.data?.length) return [];
        rowsList = (minimal.data as { id: string; league_id: string; user_id: string; role: string; joined_at: string }[]).map(
          (r) => ({
            ...r,
            team_name: null as string | null,
            faction_emoji: null as string | null,
            manager_avatar_url: null as string | null,
            manager_catchphrase: null as string | null,
          })
        );
      } else {
        rowsList = ((partial.data ?? []) as { id: string; league_id: string; user_id: string; role: string; joined_at: string; team_name?: string | null }[]).map(
          (r) => ({
            ...r,
            faction_emoji: null as string | null,
            manager_avatar_url: null as string | null,
            manager_catchphrase: null as string | null,
          })
        );
      }
    } else {
      const fallback = await supabase
        .from("league_members")
        .select("id, league_id, user_id, role, joined_at")
        .eq("league_id", leagueId)
        .order("joined_at", { ascending: true });
      if (fallback.error || !fallback.data?.length) return [];
      rowsList = (fallback.data as { id: string; league_id: string; user_id: string; role: string; joined_at: string }[]).map(
        (r) => ({
          ...r,
          team_name: null as string | null,
          faction_emoji: null as string | null,
          manager_avatar_url: null as string | null,
          manager_catchphrase: null as string | null,
        })
      );
    }
  } else {
    rowsList = (full.data ?? []) as unknown as Row[];
  }
  if (!rowsList.length) return [];

  const userIds = [...new Set(rowsList.map((r) => r.user_id))];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url")
    .in("id", userIds);

  const profileByUserId = Object.fromEntries(
    (profiles ?? []).map((p) => [p.id, p as { display_name: string | null; avatar_url: string | null }])
  );

  return rowsList.map((r) => {
    const p = profileByUserId[r.user_id];
    return {
      ...r,
      display_name: p?.display_name ?? null,
      team_name: r.team_name ?? null,
      faction_emoji: r.faction_emoji ?? null,
      manager_avatar_url: r.manager_avatar_url ?? null,
      manager_catchphrase: r.manager_catchphrase ?? null,
      avatar_url: p?.avatar_url ?? null,
    };
  }) as LeagueMember[];
}

/**
 * Get league member user_ids using service role. For use by cron/scheduled jobs (e.g. draft order at 1hr before).
 */
export async function getLeagueMemberUserIdsForAdmin(leagueId: string): Promise<string[]> {
  const admin = getAdminClient();
  if (!admin) return [];
  const { data, error } = await admin
    .from("league_members")
    .select("user_id")
    .eq("league_id", leagueId)
    .order("joined_at", { ascending: true });
  if (error || !data?.length) return [];
  const seen = new Set<string>();
  return (data as { user_id: string }[]).filter((r) => {
    if (seen.has(r.user_id)) return false;
    seen.add(r.user_id);
    return true;
  }).map((r) => r.user_id);
}

/**
 * Update the current user's faction name and emoji for a league. Only the member themselves can update.
 */
export async function updateLeagueMemberFactionInfo(
  leagueId: string,
  payload: { teamName: string | null; factionEmoji: string | null }
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const validatedName = validateFactionNameForSave(payload.teamName);
  if (!validatedName.ok) return { error: validatedName.error };
  const validatedEmoji = validateFactionEmojiForSave(payload.factionEmoji);
  if (!validatedEmoji.ok) return { error: validatedEmoji.error };

  const { error } = await supabase
    .from("league_members")
    .update({
      team_name: validatedName.value,
      faction_emoji: validatedEmoji.value,
    })
    .eq("league_id", leagueId)
    .eq("user_id", user.id);

  if (error) {
    const msg = error.message ?? "";
    if (msg.includes("faction_emoji") && (msg.includes("schema cache") || msg.includes("column"))) {
      return {
        error:
          "Faction logo could not be saved. Run supabase/league_members_faction_emoji.sql in the Supabase SQL Editor.",
      };
    }
    if (msg.includes("team_name") && (msg.includes("schema cache") || msg.includes("column"))) {
      return {
        error:
          "Team name could not be saved. The database may be missing the team_name column. Run the SQL in supabase/league_members_team_name.sql in your Supabase project (SQL Editor).",
      };
    }
    return { error: msg };
  }
  return {};
}

/**
 * Set or clear per-league manager avatar for the current user. URL must be under
 * manager-avatars/{userId}/leagues/{leagueId}/ in this project.
 */
export async function updateLeagueMemberManagerAvatar(
  leagueId: string,
  managerAvatarUrl: string | null
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const supabaseOrigin =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") ?? "";

  if (managerAvatarUrl !== null) {
    const t = managerAvatarUrl.trim();
    if (!t) {
      return { error: "Invalid league avatar URL." };
    }
    if (!isLeagueManagerAvatarUrl(t, user.id, leagueId, supabaseOrigin)) {
      return { error: "Invalid league avatar URL. Upload from this page or clear it." };
    }
  }

  const { error } = await supabase
    .from("league_members")
    .update({ manager_avatar_url: managerAvatarUrl?.trim() || null })
    .eq("league_id", leagueId)
    .eq("user_id", user.id);

  if (error) {
    const msg = error.message ?? "";
    if (msg.includes("manager_avatar") && (msg.includes("schema cache") || msg.includes("column"))) {
      return {
        error:
          "League avatar could not be saved. Run supabase/league_members_manager_avatar.sql in the Supabase SQL Editor.",
      };
    }
    return { error: msg };
  }
  return {};
}

/**
 * Set or clear per-league manager catchphrase for the current user. Must be unique in the league (case-insensitive).
 */
export async function updateLeagueMemberCatchphrase(
  leagueId: string,
  catchphrase: string | null
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const validated = validateManagerCatchphraseForSave(catchphrase);
  if (!validated.ok) return { error: validated.error };

  const { error } = await supabase
    .from("league_members")
    .update({ manager_catchphrase: validated.value })
    .eq("league_id", leagueId)
    .eq("user_id", user.id);

  if (error) {
    const msg = error.message ?? "";
    const code = (error as { code?: string }).code;
    if (
      code === "23505" &&
      (msg.toLowerCase().includes("catchphrase") ||
        msg.includes("league_members_league_catchphrase_ci_unique"))
    ) {
      return {
        error: "Someone else in this league already uses that catchphrase. Try a different one.",
      };
    }
    if (msg.includes("manager_catchphrase") && (msg.includes("schema cache") || msg.includes("column"))) {
      return {
        error:
          "Catchphrase could not be saved. Run supabase/league_members_manager_catchphrase.sql in the Supabase SQL Editor.",
      };
    }
    return { error: msg };
  }
  return {};
}

/**
 * Create an invite for a league. Returns the full join URL and token. Commissioner only.
 */
export async function createLeagueInvite(
  leagueId: string,
  expiresInDays: number = INVITE_LINK_EXPIRY_DAYS
): Promise<{ url: string; token: string; join_code?: string | null; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { url: "", token: "", error: "Not authenticated" };

  const { data: league } = await supabase
    .from("leagues")
    .select("id, commissioner_id, slug, join_code")
    .eq("id", leagueId)
    .single();

  if (!league || league.commissioner_id !== user.id) {
    return { url: "", token: "", error: "Not the GM" };
  }

  const joinCode = (league as { join_code?: string | null }).join_code ?? null;

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
  return { url, token, join_code: joinCode };
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

export async function joinLeagueWithCode(code: string): Promise<{
  ok: boolean;
  league_slug?: string;
  error?: string;
  message?: string;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("join_league_with_code", {
    p_code: code.trim(),
  });

  if (error) return { ok: false, error: error.message };
  const result = data as { ok: boolean; league_slug?: string; error?: string; message?: string };
  return result;
}

// --- Commissioner manual rosters (league_rosters) ---

export type LeagueRosterEntry = {
  wrestler_id: string;
  contract: string | null;
  /** YYYY-MM-DD when added (for matchup display). */
  acquired_at?: string;
  /** YYYY-MM-DD when dropped (for matchup display). */
  released_at?: string | null;
};

/** Stint for scoring: points count when event_date >= acquired_at and (released_at is null or event_date <= released_at). */
export type LeagueRosterStint = {
  user_id: string;
  wrestler_id: string;
  contract: string | null;
  acquired_at: string; // YYYY-MM-DD
  released_at: string | null; // YYYY-MM-DD
  /** acquired_at timestamp (timestamptz); when missing, scoring falls back to acquired_at date */
  acquired_at_ts?: string | null;
  /** released_at timestamp (timestamptz); when missing, scoring falls back to released_at date end-of-day */
  released_at_ts?: string | null;
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
 * Same as getRostersForLeague but uses service role so all teams' rosters are returned.
 * Use in autopick/cron so draft state is correct regardless of RLS.
 */
export async function getRostersForLeagueAdmin(
  leagueId: string
): Promise<Record<string, LeagueRosterEntry[]>> {
  const admin = getAdminClient();
  if (!admin) return {};
  const { data, error } = await admin
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
    .select(
      "user_id, wrestler_id, contract, acquired_at, released_at, acquired_at_ts, released_at_ts"
    )
    .eq("league_id", leagueId)
    .order("acquired_at", { ascending: true });

  if (error) {
    // Allow running before the timestamp migration is applied.
    const isColumnError =
      /column.*(acquired_at_ts|released_at_ts) does not exist/i.test(error.message ?? "") ||
      /schema cache/i.test(error.message ?? "");
    if (!isColumnError) return [];

    const fallback = await supabase
      .from("league_rosters")
      .select("user_id, wrestler_id, contract, acquired_at, released_at")
      .eq("league_id", leagueId)
      .order("acquired_at", { ascending: true });

    const fbRows = (fallback.data ?? []) as {
      user_id: string;
      wrestler_id: string;
      contract: string | null;
      acquired_at: string;
      released_at: string | null;
    }[];

    return fbRows.map((r) => ({
      user_id: r.user_id,
      wrestler_id: r.wrestler_id,
      contract: r.contract,
      acquired_at: String(r.acquired_at ?? "").slice(0, 10),
      released_at: r.released_at ? String(r.released_at).slice(0, 10) : null,
      acquired_at_ts: null,
      released_at_ts: null,
    }));
  }

  const rows = (data ?? []) as {
    user_id: string;
    wrestler_id: string;
    contract: string | null;
    acquired_at: string;
    released_at: string | null;
    acquired_at_ts?: string | null;
    released_at_ts?: string | null;
  }[];

  return rows.map((r) => ({
    user_id: r.user_id,
    wrestler_id: r.wrestler_id,
    contract: r.contract,
    acquired_at: String(r.acquired_at ?? "").slice(0, 10),
    released_at: r.released_at ? String(r.released_at).slice(0, 10) : null,
    acquired_at_ts: r.acquired_at_ts ? String(r.acquired_at_ts) : null,
    released_at_ts: r.released_at_ts ? String(r.released_at_ts) : null,
  }));
}

/** Map wrestler id → display name for roster ↔ event slug matching (personas, broadcast names). */
export async function getWrestlerDisplayNamesByIds(wrestlerIds: string[]): Promise<Record<string, string>> {
  const uniq = [...new Set(wrestlerIds.filter(Boolean))];
  if (!uniq.length) return {};
  const supabase = await createClient();
  const { data } = await supabase.from("wrestlers").select("id, name").in("id", uniq);
  return Object.fromEntries(
    (data ?? []).map((w: { id: string; name: string | null }) => [w.id, w.name ?? w.id])
  );
}

/** Sunday of the week (weekStart is Monday YYYY-MM-DD). */
function getSundayOfWeek(weekStart: string): string {
  const d = new Date(weekStart + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + 6);
  return d.toISOString().slice(0, 10);
}

/**
 * Roster for the week: everyone who was on the team at any time during the week.
 * acquired_at <= weekEnd and (released_at is null or released_at >= weekStart).
 * So mid-week adds (e.g. Nia Jax Friday) and mid-week drops (e.g. Maxxine Dupri Friday) both appear;
 * points are still per-event (each wrestler only gets points for events while on roster).
 * Returns acquired_at and released_at on each entry for matchup display (add date / drop date).
 * Ordered by acquired_at per user.
 */
export async function getRostersForLeagueForWeek(
  leagueId: string,
  weekStartMonday: string
): Promise<Record<string, LeagueRosterEntry[]>> {
  const weekEndSunday = getSundayOfWeek(weekStartMonday);
  const stints = await getRosterStintsForLeague(leagueId);
  const byUser: Record<string, LeagueRosterEntry[]> = {};
  for (const s of stints) {
    const acquired = s.acquired_at;
    const released = s.released_at;
    if (acquired > weekEndSunday) continue;
    if (released != null && released < weekStartMonday) continue;
    if (!byUser[s.user_id]) byUser[s.user_id] = [];
    byUser[s.user_id].push({
      wrestler_id: s.wrestler_id,
      contract: s.contract,
      acquired_at: acquired,
      released_at: released ?? undefined,
    });
  }
  for (const arr of Object.values(byUser)) {
    arr.sort((a, b) => (a.acquired_at ?? "").localeCompare(b.acquired_at ?? "") || a.wrestler_id.localeCompare(b.wrestler_id));
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

  const rules = await getRosterRulesForLeagueId(supabase, leagueId);

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
  const clock = new Date();
  const acquiredAtTs = timestamptzForAcquiredAtDate(acquiredDate, clock);
  const { error } = await insertClient.from("league_rosters").insert({
    league_id: leagueId,
    user_id: userId,
    wrestler_id: wid,
    contract: contract?.trim() || null,
    acquired_at: acquiredDate,
    acquired_at_ts: acquiredAtTs,
    released_at: null,
  });

  if (error) {
    const isColumnError = /column.*acquired_at_ts does not exist/i.test(error.message ?? "");
    if (isColumnError) {
      const { error: error2 } = await insertClient.from("league_rosters").insert({
        league_id: leagueId,
        user_id: userId,
        wrestler_id: wid,
        contract: contract?.trim() || null,
        acquired_at: acquiredDate,
        released_at: null,
      });
      if (error2) return { error: error2.message };
      return {};
    }
    return { error: error.message };
  }
  return {};
}

/**
 * Remove a wrestler from a member's roster (set released_at = today so points before today still count).
 * By default uses RLS (commissioner only). Pass useServiceRole: true for owner self-service drop.
 */
export async function removeWrestlerFromRoster(
  leagueId: string,
  userId: string,
  wrestlerId: string,
  releasedAt?: string | null,
  useServiceRole?: boolean
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const releasedDate =
    (releasedAt && /^\d{4}-\d{2}-\d{2}$/.test(releasedAt.trim()) ? releasedAt.trim() : null) ||
    new Date().toISOString().slice(0, 10);
  const clock = new Date();
  const releasedAtTs = timestamptzForReleasedAtDate(releasedDate, clock);

  const client = useServiceRole && getAdminClient() ? getAdminClient()! : supabase;
  let updated: { id: string } | null = null;
  let error: { message: string } | null = null;
  try {
    const res = await client
      .from("league_rosters")
      .update({ released_at: releasedDate, released_at_ts: releasedAtTs })
      .eq("league_id", leagueId)
      .eq("user_id", userId)
      .eq("wrestler_id", String(wrestlerId).trim())
      .is("released_at", null)
      .select("id")
      .maybeSingle();
    updated = (res.data ?? null) as { id: string } | null;
    error = res.error as { message: string } | null;
  } catch (e) {
    error = e as { message: string };
  }

  // If the timestamp migration hasn't been applied yet, fall back to date-only updates.
  const isColumnError =
    error &&
    /column.*released_at_ts does not exist/i.test(error.message ?? "") ? true : false;
  if (isColumnError) {
    const res = await client
      .from("league_rosters")
      .update({ released_at: releasedDate })
      .eq("league_id", leagueId)
      .eq("user_id", userId)
      .eq("wrestler_id", String(wrestlerId).trim())
      .is("released_at", null)
      .select("id")
      .maybeSingle();
    updated = (res.data ?? null) as { id: string } | null;
    error = res.error as { message: string } | null;
  }

  if (error) return { error: error.message };
  if (!updated) return { error: "Wrestler not on roster or already released." };
  return {};
}

export type PointsBySlug = Record<string, { rsPoints: number; plePoints: number; beltPoints: number }>;

/** Last calendar day (UTC) of the month containing YYYY-MM-DD. */
function utcLastDayOfMonthContaining(ymd: string): string {
  const d = new Date(ymd.slice(0, 10) + "T12:00:00.000Z");
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
}

/**
 * Load events in league date range and return points per wrestler slug and per owner.
 * Owner points use acquisition/release windows: only count event points when
 * event_date >= stint.acquired_at and (stint.released_at is null or event_date <= stint.released_at).
 * So: traded wrestlers' past points stay with the original team; new team gets points from trade date on.
 * Dropped wrestlers' points stay with the team that had them; FA signings only get points from sign date on.
 * See docs/PUBLIC_LEAGUES_SCORING.md "Points attribution: trades, drops, and free agents".
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

  // Use draft_date as start when set so events on the draft day (e.g. RAW same day as draft) count. Otherwise start_date/created_at.
  const draftStart = league.draft_date ? String(league.draft_date).slice(0, 10) : "";
  const start =
    draftStart ||
    (league.start_date ? String(league.start_date).slice(0, 10) : "") ||
    "";
  const end = league.end_date ?? "";
  if (!start && !end) return empty;

  const eventsSelectWithStart = supabase
    .from("events")
    .select("id, name, date, broadcast_start_ts, matches")
    .eq("status", "completed")
    .order("date", { ascending: true });

  const { data: eventsWithStart, error: eventsErr } = await eventsSelectWithStart;
  const events =
    eventsWithStart ??
    (eventsErr && /column.*broadcast_start_ts does not exist/i.test(eventsErr.message ?? "")
      ? (
          await supabase
            .from("events")
            .select("id, name, date, matches")
            .eq("status", "completed")
            .order("date", { ascending: true })
        ).data ?? []
      : []);

  const filtered = (events ?? []).filter((e) => {
    const d = (e.date ?? "").toString().slice(0, 10);
    if (start && d < start) return false;
    if (end && d > end) return false;
    return true;
  });

  const pointsBySlug = aggregateWrestlerPoints(filtered) as PointsBySlug;
  const stints = await getRosterStintsForLeague(leagueId);
  const wrestlerDisplayNames = await getWrestlerDisplayNamesByIds(stints.map((s) => s.wrestler_id));
  const pointsByOwner: Record<string, number> = {};
  /** Per owner, points from each wrestler (only while on roster). For team page per-wrestler breakdown. */
  const pointsByOwnerByWrestler: Record<string, Record<string, number>> = {};
  let kotrCarryOver: Record<string, number> = {};
  // See `lib/teamScoring.ts` for why this is needed (UTC roster dates vs local event dates).
  const ROSTER_STINT_DATE_OFFSET_DAYS = -1;
  function shiftYmd(ymd: string, days: number): string {
    if (!ymd) return ymd;
    const d = new Date(ymd + "T00:00:00Z");
    if (Number.isNaN(d.getTime())) return ymd;
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  }
  const sortedEvents = [...filtered].sort((a, b) =>
    String(a.date ?? "").localeCompare(String(b.date ?? ""))
  );
  const useBroadcastForMonthlyBelt = sortedEvents.some(
    (e) => !!(e as { broadcast_start_ts?: string | null }).broadcast_start_ts
  );
  for (const event of sortedEvents) {
    const eventDate = (event.date ?? "").toString().slice(0, 10);
    const { pointsBySlug: eventPoints, updatedCarryOver } = getPointsForSingleEvent(
      event,
      kotrCarryOver
    );
    kotrCarryOver = updatedCarryOver;
    const bestStintByWrestlerId: Record<string, typeof stints[number]> = {};
    // When `broadcast_start_ts` exists: calendar overlap + timestamp vs broadcast (see rosterStintEventWindow).
    // When absent: legacy end-of-event-day UTC vs shifted stint boundaries (+ optional ts alignment).
    const eventEndOfDayMs = Date.parse(`${eventDate}T23:59:59.999Z`);
    const eventStartMs = (event as { broadcast_start_ts?: string | null }).broadcast_start_ts
      ? Date.parse(String((event as { broadcast_start_ts?: string | null }).broadcast_start_ts))
      : NaN;
    const useBroadcastStart = Number.isFinite(eventStartMs);
    const eventMs = eventEndOfDayMs;
    const broadcastStartMs = useBroadcastStart ? eventStartMs : undefined;

    // If roster stint windows overlap, only award points to a single "best" stint per wrestler_id.
    for (const stint of stints) {
      if (
        !rosterStintActiveForEvent({
          eventDate,
          eventMs,
          broadcastStartMs,
          useBroadcastStart,
          stint,
          rosterStintDateOffsetDays: ROSTER_STINT_DATE_OFFSET_DAYS,
        })
      ) {
        continue;
      }

      const wid = stint.wrestler_id;
      const currentBest = bestStintByWrestlerId[wid];
      if (!currentBest) {
        bestStintByWrestlerId[wid] = stint;
        continue;
      }

      if (compareStintsForEventTieBreak(stint, currentBest, useBroadcastStart, ROSTER_STINT_DATE_OFFSET_DAYS) < 0) {
        bestStintByWrestlerId[wid] = stint;
      }
    }

    for (const stint of stints) {
      if (
        !rosterStintActiveForEvent({
          eventDate,
          eventMs,
          broadcastStartMs,
          useBroadcastStart,
          stint,
          rosterStintDateOffsetDays: ROSTER_STINT_DATE_OFFSET_DAYS,
        })
      ) {
        continue;
      }

      if (bestStintByWrestlerId[stint.wrestler_id] !== stint) continue;

      const pts = eventPointsForRosterStint(
        eventPoints,
        stint.wrestler_id,
        wrestlerDisplayNames[stint.wrestler_id],
        eventDate
      );

      pointsByOwner[stint.user_id] = (pointsByOwner[stint.user_id] ?? 0) + pts;
      if (pts > 0) {
        if (!pointsByOwnerByWrestler[stint.user_id]) pointsByOwnerByWrestler[stint.user_id] = {};
        pointsByOwnerByWrestler[stint.user_id][stint.wrestler_id] =
          (pointsByOwnerByWrestler[stint.user_id][stint.wrestler_id] ?? 0) + pts;
      }
    }
  }

  // End-of-month WWE/UAE title holder points: credit the manager who had the wrestler on roster on that month-end (same idea as matchups weekly bonus).
  try {
    const [histResult, changesResult] = await Promise.all([
      supabase
        .from("championship_history")
        .select(
          "champion_slug, champion_id, champion, champion_name, title, title_name, won_date, start_date, lost_date, end_date"
        )
        .order("won_date", { ascending: true }),
      supabase
        .from(CHAMPIONSHIP_CHANGES_TABLE_NAME)
        .select("championship_type, champion, champion_slug, date")
        .order("date", { ascending: true }),
    ]);
    const histRows = histResult.data;
    const changesRows = changesResult.error ? [] : (changesResult.data ?? []);
    const leagueEndYmd = end ? String(end).slice(0, 10) : "";
    const eventsForBeltReignInference = (events ?? []).filter((e) => {
      const d = (e.date ?? "").toString().slice(0, 10);
      if (!d || d < BELT_REIGN_INFERENCE_EVENTS_FROM) return false;
      if (leagueEndYmd && d > leagueEndYmd) return false;
      return true;
    });
    const inferredReigns = inferReignsFromEvents(eventsForBeltReignInference);
    const changesReigns = inferReignsFromChampionshipChanges(changesRows);
    const reigns = mergeReigns(histRows ?? [], [...inferredReigns, ...changesReigns]);
    const beltFirstMonth = firstMonthEndOnOrAfter(start);
    const lastMonthCap = beltScoringLastMonthEndInclusive(leagueEndYmd || undefined);
    const today = new Date().toISOString().slice(0, 10);
    let monthEnds = getCompletedMonthEndsForBeltScoring(beltFirstMonth, lastMonthCap);
    if (isRoadToSummerSlam2026WithSummerslamFinale(leagueEndYmd)) {
      monthEnds = transformRts2026BeltMonthEnds(monthEnds, leagueEndYmd);
    }
    for (const monthEnd of monthEnds) {
      if (monthEnd >= today) continue;
      const beltBySlug = computeEndOfMonthBeltPointsForSingleMonth(reigns, monthEnd, beltFirstMonth);
      for (const stint of stints) {
        if (
          !rosterStintActiveForMonthEndBelt({
            stint,
            monthEndYmd: monthEnd,
            useBroadcastStart: useBroadcastForMonthlyBelt,
          })
        ) {
          continue;
        }
        const name = wrestlerDisplayNames[stint.wrestler_id];
        const pts = sumMonthlyBeltPointsForStint(beltBySlug, stint.wrestler_id, name, monthEnd);
        if (pts <= 0) continue;
        pointsByOwner[stint.user_id] = (pointsByOwner[stint.user_id] ?? 0) + pts;
        if (!pointsByOwnerByWrestler[stint.user_id]) pointsByOwnerByWrestler[stint.user_id] = {};
        pointsByOwnerByWrestler[stint.user_id][stint.wrestler_id] =
          (pointsByOwnerByWrestler[stint.user_id][stint.wrestler_id] ?? 0) + pts;
      }
    }
  } catch {
    /* championship_history may be missing in some envs */
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
