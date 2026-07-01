import { cache as reactCache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getServerAuth } from "@/lib/supabase/serverAuth";
import { getAdminClient } from "@/lib/supabase/admin";
import { getIsSiteAdmin } from "@/lib/auth/siteAdmin";
import {
  getRosterRulesForLeagueId,
  leagueIncludesNxt,
  leagueUsesSalaryCap,
  leagueUsesWeeklyPstBeltHold,
  MIN_LEAGUE_TEAMS,
  ROAD_TO_SUMMERSLAM_SEASON_SLUG,
  SALARY_CAP_LEAGUE_TYPE,
  SALARY_CAP_MAX_ROSTER_SIZE,
} from "@/lib/leagueStructure";
import { isMainBrandWrestlerRosterForLeague, wrestlerRosterFromBrand } from "@/lib/wrestlerRosterFromBrand";
import { getDefaultStartEndForSeason, PUBLIC_SALARY_CAP_SEASON_SLUG, STANDARD_USER_CREATE_SEASON_SLUG } from "@/lib/leagueSeasons";
import {
  computePublicLeagueRegistrationSchedule,
  extendPublicLeagueRegistrationOneWeek,
  isPublicLeagueRegistrationOpen,
  publicLeagueStatusForMemberCount,
} from "@/lib/publicLeagueRegistration";
import { isPublicSalaryCapLeague } from "@/lib/publicLeagueSchedule";
import { snapshotLeagueSalaryCosts } from "@/lib/leagueSalarySnapshots";
import { getCivilYmdInPst, isPastEndOfDayPst } from "@/lib/pstCivilTime";
import { aggregateWrestlerPoints, getPointsForSingleEvent } from "@/lib/scoring/aggregateWrestlerPoints.js";
import { brandByWrestlerSlugFromRows } from "@/lib/wrestlerBrandLookup";
import { classifyEventType, EVENT_TYPES } from "@/lib/scoring/parsers/eventClassifier.js";
import { eventPointsForRosterStint, sumMonthlyBeltPointsForStint } from "@/lib/scoring/rosterStintEventPoints";
import {
  BELT_REIGN_INFERENCE_EVENTS_FROM,
  computeEndOfMonthBeltPointsForSingleMonth,
  computeWeeklyBeltHoldPointsForWeekEndSunday,
  firstLegacyCalendarMonthEndEligibleForLeagueStart,
  getCompletedMonthEndsForBeltScoring,
  inferReignsFromEvents,
  mergeReigns,
} from "@/lib/scoring/endOfMonthBeltPoints.js";
import {
  beltScoringLastWeekEndSundayInclusive,
  firstEligibleWeekEndSundayForLeagueStart,
  getCompletedWeekEndSundaysForBeltScoring,
  weekEndSundayContaining,
} from "@/lib/beltWeeklyHold";
import {
  compareStintsForEventTieBreak,
  rosterStintActiveForEvent,
  rosterStintActiveForMonthEndBelt,
  rosterStintActiveForWeeklyBeltHold,
} from "@/lib/scoring/rosterStintEventWindow";
import {
  enrichRosterStintsWithActivityTimestamps,
  fetchLeagueActivityForStintEnrichment,
} from "@/lib/rosterStintActivityEnrichment";
import { getEventBroadcastStartMs } from "@/lib/eventBroadcastStart";
import { timestamptzForAcquiredAtDate, timestamptzForReleasedAtDate, rosterCivilDateYmd } from "@/lib/rosterTimestamps";
import { EVENT_STATUSES_FOR_SCORING, EVENT_STATUSES_FOR_WEEK_SCHEDULE, SCORING_EVENTS_FETCH_LIMIT } from "@/lib/eventsScoring";
import { getCurrentChampionsMonthlyBeltBySlug } from "@/lib/scoring/currentChampionsBeltSnapshot";
import { draftEquivalentSlugs } from "@/lib/scoring/personaResolution.js";
import { validateFactionNameForSave } from "@/lib/factionName";
import { validateManagerCatchphraseForSave } from "@/lib/managerCatchphrase";
import { validateFactionEmojiForSave } from "@/lib/factionEmoji";
import { isLeagueManagerAvatarUrl } from "@/lib/managerAvatarBucket";
import {
  CHAMPIONSHIP_CHANGES_TABLE_NAME,
  inferReignsFromChampionshipChanges,
} from "@/lib/championshipCurrentFromChanges";
import { normalizeChampionshipHistoryRow } from "@/lib/championshipHistoryNormalize";

const cacheFn: <T extends (...args: never[]) => unknown>(fn: T) => T =
  typeof reactCache === "function"
    ? (reactCache as <T extends (...args: never[]) => unknown>(fn: T) => T)
    : ((fn) => fn);
import {
  filterRostersForSalaryCapSetupVisibility,
  getSalaryCapRosterSetupCompleteByUserId,
} from "@/lib/leagueOnboarding";
import { generateJoinCode, INVITE_LINK_EXPIRY_DAYS } from "@/lib/leagueJoinCode";
import { awardLeagueJoinXp } from "@/lib/xp/leagueJoinAward";
import { maybeAwardLeagueStartedXpBySlug } from "@/lib/xp/leagueStartedAward";
import {
  countPlacedLeagueMembers,
  filterPlacedLeagueMembers,
  markPublicLeagueJoinPending,
  purgeUnplacedPublicLeagueMembersIfRegistrationClosed,
} from "@/lib/leaguePlacement";
import {
  beltScoringLastMonthEndInclusive,
  legacySeasonEndBeltSnapshotYmd,
  shouldSkipJulyMonthEndBeltForRts2026,
} from "@/lib/beltRts2026JulyDeferral";

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
  /** Admin/beta: include NXT in draft pool and weekly scoring. */
  include_nxt?: boolean | null;
  max_teams?: number | null;
  visibility_type?: "private" | "public" | null;
  public_status?: "open" | "full" | "awaiting_minimum" | "active" | null;
  public_sequence?: number | null;
  auto_reactivate?: boolean | null;
  draft_style?: "snake" | "linear";
  draft_type?: DraftType | null;
  time_per_pick_seconds?: number | null;
  draft_order_method?: DraftOrderMethod | null;
  draft_status?: "not_started" | "in_progress" | "ready_for_review" | "completed";
  draft_current_pick?: number | null;
  manager_note?: string | null;
  /** Permanent join code (XXXX-XXXX); does not expire. */
  join_code?: string | null;
  /** Public leagues: enrollment closes at this instant (Monday 5 PM PT). */
  registration_closes_at?: string | null;
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
  placement_status?: "pending" | "active" | null;
  onboarding_completed_at?: string | null;
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
  /** Site admin only; stored on the league row. */
  include_nxt?: boolean | null;
  max_teams?: number | null;
  visibility_type?: "private" | "public" | null;
}): Promise<{ league?: League; error?: string }> {
  const { supabase, user } = await getServerAuth();
  if (!user) return { error: "Not authenticated" };
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_site_admin")
    .eq("id", user.id)
    .maybeSingle();
  const isSiteAdmin = Boolean((profile as { is_site_admin?: boolean | null } | null)?.is_site_admin);

  const requestedName = params.name?.trim();
  if (!requestedName) return { error: "League name is required" };

  const seasonSlugInput = params.season_slug?.trim();
  if (!seasonSlugInput) return { error: "Select a season." };

  const visibilityType: "private" | "public" = params.visibility_type === "public" ? "public" : "private";
  const isPublicSalaryCapCreate = visibilityType === "public";

  const yearParsed = Math.floor(Number(params.season_year));
  const year =
    Number.isFinite(yearParsed) && yearParsed >= 2020 && yearParsed <= 2030
      ? yearParsed
      : new Date().getFullYear();

  const seasonSlug = isPublicSalaryCapCreate ? PUBLIC_SALARY_CAP_SEASON_SLUG : seasonSlugInput;

  let start_date: string | null;
  let end_date: string | null;
  let registration_closes_at: string | null = null;
  if (isPublicSalaryCapCreate) {
    const schedule = computePublicLeagueRegistrationSchedule();
    start_date = schedule.season_start_ymd;
    end_date = schedule.season_end_ymd;
    registration_closes_at = schedule.registration_closes_at;
  } else {
    const window = getDefaultStartEndForSeason(seasonSlug, year);
    if (!window) return { error: "Invalid season." };
    start_date = window.start_date;
    end_date = window.end_date;
  }

  const maxTeamsCapForUser = isSiteAdmin ? 16 : 6;
  const maxTeamsRequested =
    params.max_teams != null && Number.isFinite(Number(params.max_teams))
      ? Math.min(maxTeamsCapForUser, Math.max(3, Math.floor(Number(params.max_teams))))
      : null;
  const max_teams = isPublicSalaryCapCreate ? null : maxTeamsRequested;
  const admin = getAdminClient();
  if (!admin) {
    return {
      error:
        "Server configuration: SUPABASE_SERVICE_ROLE_KEY is not set. Add it in Netlify → Site settings → Environment variables (from Supabase Dashboard → Settings → API → service_role).",
    };
  }
  const public_status =
    visibilityType === "public"
      ? "open"
      : null;
  let publicSequenceUsed: number | null = null;
  let name = requestedName;
  const baseSlugPrivate = slugify(name);
  const { data: existing } = await admin.from("leagues").select("slug");
  const existingSlugs = new Set((existing ?? []).map((r) => r.slug));

  const draft_date = null;
  let league_type = params.league_type?.trim() || null;
  if (isPublicSalaryCapCreate) {
    league_type = SALARY_CAP_LEAGUE_TYPE;
  } else if (league_type === SALARY_CAP_LEAGUE_TYPE && !isSiteAdmin) {
    return { error: "Only site administrators can create salary cap leagues." };
  }
  const include_nxt_requested = Boolean(params.include_nxt);
  if (include_nxt_requested && !isSiteAdmin) {
    return { error: "Only site administrators can create leagues that include NXT." };
  }
  if (include_nxt_requested && league_type !== "head_to_head" && league_type !== "salary_cap") {
    return {
      error: "Include NXT is only available for Head-to-Head leagues (admin testing).",
    };
  }
  const include_nxt = league_type === "salary_cap" ? true : include_nxt_requested;

  const leagueSelect =
    "id, name, slug, commissioner_id, start_date, end_date, season_slug, draft_date, league_type, include_nxt, max_teams, visibility_type, public_status, public_sequence, join_code, created_at";

  let league: League | null = null;
  let createError: string | undefined;
  for (let attempt = 0; attempt < 30; attempt++) {
    let slug = baseSlugPrivate;
    if (visibilityType === "public") {
      const { data: seqRows } = await admin
        .from("leagues")
        .select("public_sequence")
        .eq("visibility_type", "public")
        .not("public_sequence", "is", null)
        .order("public_sequence", { ascending: false })
        .limit(1);
      const maxSeq = Number((seqRows?.[0] as { public_sequence?: number } | undefined)?.public_sequence ?? 0);
      publicSequenceUsed = Number.isFinite(maxSeq) ? maxSeq + 1 : 1;
      name = `Public League ${publicSequenceUsed}`;
      slug = slugify(name);
    } else {
      slug = makeSlugUnique(baseSlugPrivate, existingSlugs);
    }
    const join_code = generateJoinCode();
    const isSalaryCapLeague = league_type === "salary_cap";
    const result = await admin
      .from("leagues")
      .insert({
        name,
        slug,
        commissioner_id: user.id,
        start_date,
        end_date,
        season_slug: seasonSlug,
        draft_date,
        draft_time: null,
        draft_type: isSalaryCapLeague ? "salary_cap" : "autopick",
        draft_style: "snake",
        draft_order_method: isSalaryCapLeague ? "manual_by_gm" : "random_one_hour_before",
        draft_status: isSalaryCapLeague ? "in_progress" : "not_started",
        league_type,
        include_nxt,
        max_teams,
        visibility_type: visibilityType,
        public_status,
        public_sequence: publicSequenceUsed,
        join_code,
        registration_closes_at,
      })
      .select(leagueSelect)
      .single();

    if (!result.error && result.data) {
      league = result.data as League;
      break;
    }
    const msg = result.error?.message ?? "";
    const code = (result.error as { code?: string })?.code;
    if (code === "23505" && (msg.includes("join_code") || msg.includes("public_sequence") || msg.includes("slug"))) {
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
    ...(isPublicSalaryCapCreate ? { placement_status: "pending" } : {}),
  });

  if (isPublicSalaryCapCreate) {
    await snapshotLeagueSalaryCosts(league.id);
  }

  return { league: league as League };
}

/**
 * Get a league by slug. Returns null if not found or user is not a member.
 * Site admins who are not members can still load any league (read-only member `owner` role) for support / preview.
 * If draft columns are missing (migration not run), returns league with default draft fields.
 * Wrapped in `cache()` so multiple callers in one RSC request share one auth + DB round-trip.
 */
export const getLeagueBySlug = cacheFn(
  async (slug: string): Promise<(League & { role: "commissioner" | "owner" }) | null> => {
    const { supabase, user } = await getServerAuth();
    if (!user) return null;

    const fullSelect =
      "id, name, slug, commissioner_id, start_date, end_date, season_slug, draft_date, draft_time, league_type, include_nxt, max_teams, visibility_type, public_status, public_sequence, join_code, auto_reactivate, draft_style, draft_type, time_per_pick_seconds, draft_order_method, draft_status, draft_current_pick, manager_note, created_at";
    const fullSelectNoIncludeNxt =
      "id, name, slug, commissioner_id, start_date, end_date, season_slug, draft_date, draft_time, league_type, max_teams, visibility_type, public_status, public_sequence, join_code, auto_reactivate, draft_style, draft_type, time_per_pick_seconds, draft_order_method, draft_status, draft_current_pick, manager_note, created_at";
    let result = await supabase.from("leagues").select(fullSelect).eq("slug", slug).maybeSingle();
    if (
      result.error?.code === "42703" &&
      /include_nxt/i.test(result.error.message ?? "")
    ) {
      result = await supabase.from("leagues").select(fullSelectNoIncludeNxt).eq("slug", slug).maybeSingle();
      if (result.data) {
        result = { ...result, data: { ...result.data, include_nxt: false } };
      }
    }

    let league = result.data;
    const isColumnError =
      result.error &&
      (result.error.code === "42703" ||
        /column|relation.*does not exist/i.test(result.error.message ?? ""));
    if (isColumnError) {
      const minimalResult = await supabase
        .from("leagues")
        .select(
          "id, name, slug, commissioner_id, start_date, end_date, season_slug, draft_date, visibility_type, public_status, public_sequence, created_at"
        )
        .eq("slug", slug)
        .maybeSingle();
      if (minimalResult.data) {
        league = {
          ...minimalResult.data,
          draft_time: null,
          draft_style: "snake",
          draft_type: "autopick",
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

    if (!league) {
      const isAdmin = await getIsSiteAdmin();
      if (!isAdmin) return null;
      const admin = getAdminClient();
      if (!admin) return null;
      let adminResult = await admin.from("leagues").select(fullSelect).eq("slug", slug).maybeSingle();
      league = adminResult.data as typeof league;
      if (
        !league &&
        adminResult.error?.code === "42703" &&
        /include_nxt/i.test(adminResult.error.message ?? "")
      ) {
        adminResult = await admin.from("leagues").select(fullSelectNoIncludeNxt).eq("slug", slug).maybeSingle();
        if (adminResult.data) {
          league = { ...adminResult.data, include_nxt: false } as unknown as typeof league;
        }
      }
      if (!league) return null;
    }

    const { data: member } = await supabase
      .from("league_members")
      .select("role")
      .eq("league_id", league.id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (member) {
      return { ...league, role: member.role } as League & { role: "commissioner" | "owner" };
    }

    if (await getIsSiteAdmin()) {
      return { ...league, role: "owner" } as League & { role: "commissioner" | "owner" };
    }

    return null;
  }
);

/**
 * List leagues the current user is a member of.
 */
export async function getLeaguesForUser(): Promise<LeagueWithRole[]> {
  const { supabase, user } = await getServerAuth();
  if (!user) return [];

  const { data: members, error: meError } = await supabase
    .from("league_members")
    .select("league_id, role")
    .eq("user_id", user.id);

  if (meError || !members?.length) return [];

  const leagueIds = members.map((m) => m.league_id);
  const leagueResWithArchive = await supabase
    .from("leagues")
    .select(
      "id, name, slug, commissioner_id, start_date, end_date, season_slug, draft_date, draft_style, draft_status, draft_current_pick, league_type, visibility_type, public_status, public_sequence, created_at"
    )
    .in("id", leagueIds)
    .eq("is_archived", false);
  let leagues = leagueResWithArchive.data;
  let leagueError = leagueResWithArchive.error;
  if (
    leagueError &&
    (leagueError.code === "42703" || /is_archived|column/i.test(leagueError.message ?? ""))
  ) {
    const fallback = await supabase
      .from("leagues")
      .select(
        "id, name, slug, commissioner_id, start_date, end_date, season_slug, draft_date, draft_style, draft_status, draft_current_pick, league_type, visibility_type, public_status, public_sequence, created_at"
      )
      .in("id", leagueIds);
    leagues = fallback.data;
    leagueError = fallback.error;
  }

  if (leagueError || !leagues?.length) return [];

  const roleByLeagueId = Object.fromEntries(members.map((m) => [m.league_id, m.role]));
  return leagues.map((l) => ({
    ...l,
    role: roleByLeagueId[l.id] ?? "owner",
  })) as LeagueWithRole[];
}

/**
 * Get members of a league with display names. Caller must be a member.
 * Cached per request so layouts + pages that both load members hit the DB once.
 */
export const getLeagueMembers = cacheFn(async (leagueId: string): Promise<LeagueMember[]> => {
  const { supabase } = await getServerAuth();
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
    "placement_status",
    "onboarding_completed_at",
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
    } else if (msg.includes("placement_status")) {
      cols = cols.filter((c) => c !== "placement_status");
    } else if (msg.includes("onboarding_completed_at")) {
      cols = cols.filter((c) => c !== "onboarding_completed_at");
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
});

export async function getLeagueStandingsMembers(
  leagueId: string,
  league: { visibility_type?: string | null; league_type?: string | null; season_slug?: string | null }
): Promise<LeagueMember[]> {
  const members = await getLeagueMembers(leagueId);
  return filterPlacedLeagueMembers(members, league);
}

/**
 * Member list with site-admin fallback:
 * - Default: RLS-scoped `league_members` (same as any league member).
 * - Site admins: when service role is configured, always load the full member list via admin client.
 *   This matches internal-admin league tools and avoids 404s when RLS returns no rows (admin not in
 *   league) or, in edge cases, an incomplete list while still appearing "in" the league.
 */
export async function getLeagueMembersWithAdminFallback(leagueId: string): Promise<LeagueMember[]> {
  const fromRls = await getLeagueMembers(leagueId);
  const isSiteAdmin = await getIsSiteAdmin();
  if (!isSiteAdmin) return fromRls;

  const admin = getAdminClient();
  if (!admin) return fromRls;

  type AdminMemberRow = {
    id?: string;
    league_id?: string;
    user_id: string;
    role: "commissioner" | "owner";
    joined_at?: string;
    team_name?: string | null;
    faction_emoji?: string | null;
    manager_avatar_url?: string | null;
    manager_catchphrase?: string | null;
  };

  const full = await admin
    .from("league_members")
    .select(
      "id, league_id, user_id, role, joined_at, team_name, faction_emoji, manager_avatar_url, manager_catchphrase"
    )
    .eq("league_id", leagueId)
    .order("joined_at", { ascending: true });

  let rows: AdminMemberRow[] = [];
  if (full.error) {
    const fallback = await admin
      .from("league_members")
      .select("id, league_id, user_id, role, joined_at, team_name, faction_emoji")
      .eq("league_id", leagueId)
      .order("joined_at", { ascending: true });
    if (fallback.error) return fromRls;
    rows = (fallback.data ?? []) as AdminMemberRow[];
  } else {
    rows = (full.data ?? []) as AdminMemberRow[];
  }
  if (rows.length === 0) return fromRls;

  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, display_name, avatar_url")
    .in("id", userIds);
  const profileByUserId = Object.fromEntries(
    (profiles ?? []).map((p) => [p.id, p as { display_name: string | null; avatar_url: string | null }])
  );

  const fromAdmin = rows.map((r) => {
    const p = profileByUserId[r.user_id];
    return {
      id: r.id ?? `${leagueId}:${r.user_id}`,
      league_id: r.league_id ?? leagueId,
      user_id: r.user_id,
      role: r.role,
      joined_at: r.joined_at ?? "",
      team_name: r.team_name ?? null,
      faction_emoji: r.faction_emoji ?? null,
      manager_avatar_url: r.manager_avatar_url ?? null,
      manager_catchphrase: r.manager_catchphrase ?? null,
      display_name: p?.display_name ?? null,
      avatar_url: p?.avatar_url ?? null,
    };
  });

  return fromAdmin;
}

/**
 * Single membership row via service role (site-admin tooling). Returns null if not a member of the league.
 */
export async function getLeagueMemberForUserAdmin(leagueId: string, userId: string): Promise<LeagueMember | null> {
  const admin = getAdminClient();
  if (!admin) return null;

  type AdminMemberRow = {
    id?: string;
    league_id?: string;
    user_id: string;
    role: "commissioner" | "owner";
    joined_at?: string;
    team_name?: string | null;
    faction_emoji?: string | null;
    manager_avatar_url?: string | null;
    manager_catchphrase?: string | null;
  };

  let sel = await admin
    .from("league_members")
    .select(
      "id, league_id, user_id, role, joined_at, team_name, faction_emoji, manager_avatar_url, manager_catchphrase"
    )
    .eq("league_id", leagueId)
    .eq("user_id", userId)
    .maybeSingle();

  let row: AdminMemberRow | null = null;
  if (sel.error) {
    const fb = await admin
      .from("league_members")
      .select("id, league_id, user_id, role, joined_at, team_name, faction_emoji")
      .eq("league_id", leagueId)
      .eq("user_id", userId)
      .maybeSingle();
    if (fb.error || !fb.data) return null;
    row = fb.data as AdminMemberRow;
  } else {
    row = sel.data as AdminMemberRow | null;
  }
  if (!row) return null;

  const { data: p } = await admin
    .from("profiles")
    .select("display_name, avatar_url")
    .eq("id", userId)
    .maybeSingle();
  const prof = p as { display_name: string | null; avatar_url: string | null } | null;

  return {
    id: row.id ?? `${leagueId}:${row.user_id}`,
    league_id: row.league_id ?? leagueId,
    user_id: row.user_id,
    role: row.role,
    joined_at: row.joined_at ?? "",
    team_name: row.team_name ?? null,
    faction_emoji: row.faction_emoji ?? null,
    manager_avatar_url: row.manager_avatar_url ?? null,
    manager_catchphrase: row.manager_catchphrase ?? null,
    display_name: prof?.display_name ?? null,
    avatar_url: prof?.avatar_url ?? null,
  };
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
  const { supabase, user } = await getServerAuth();
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
  const { supabase, user } = await getServerAuth();
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
  const { supabase, user } = await getServerAuth();
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
  const { supabase, user } = await getServerAuth();
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
  const { supabase } = await getServerAuth();
  const { data, error } = await supabase.rpc("join_league_with_token", {
    p_token: token.trim(),
  });

  if (error) return { ok: false, error: error.message };
  const result = data as { ok: boolean; league_slug?: string; error?: string; message?: string };
  if (result.ok && result.league_slug) {
    await syncPublicLeagueStatusBySlug(result.league_slug);
    const { data: { user: u } } = await supabase.auth.getUser();
    if (u?.id) await awardLeagueJoinXp(u.id, result.league_slug);
    await maybeAwardLeagueStartedXpBySlug(result.league_slug);
  }
  return result;
}

export async function joinLeagueWithCode(code: string): Promise<{
  ok: boolean;
  league_slug?: string;
  error?: string;
  message?: string;
}> {
  const { supabase } = await getServerAuth();
  const { data, error } = await supabase.rpc("join_league_with_code", {
    p_code: code.trim(),
  });

  if (error) return { ok: false, error: error.message };
  const result = data as { ok: boolean; league_slug?: string; error?: string; message?: string };
  if (result.ok && result.league_slug) {
    await syncPublicLeagueStatusBySlug(result.league_slug);
    const { data: { user: u } } = await supabase.auth.getUser();
    if (u?.id) await awardLeagueJoinXp(u.id, result.league_slug);
    await maybeAwardLeagueStartedXpBySlug(result.league_slug);
  }
  return result;
}

export async function quickJoinOldestPublicLeague(): Promise<{
  ok: boolean;
  league_slug?: string;
  error?: string;
  message?: string;
}> {
  await closeExpiredPublicLeagues();
  const { supabase } = await getServerAuth();
  const { data, error } = await supabase.rpc("join_oldest_public_league");
  if (error) return { ok: false, error: error.message };
  const result = data as { ok: boolean; league_slug?: string; error?: string; message?: string };
  if (result.ok && result.league_slug) {
    const {
      data: { user: u },
    } = await supabase.auth.getUser();
    if (u?.id) await markPublicLeagueJoinPending(result.league_slug, u.id);
    await syncPublicLeagueStatusBySlug(result.league_slug);
    return result;
  }

  const errMsg = (result.error ?? "").trim();
  const noOpenPublic =
    /no open public leagues/i.test(errMsg) ||
    errMsg === "No open public leagues available right now.";
  if (!noOpenPublic) {
    return { ok: false, error: errMsg || "Join failed" };
  }

  const created = await createLeague({
    name: "Public League",
    season_slug: PUBLIC_SALARY_CAP_SEASON_SLUG,
    league_type: SALARY_CAP_LEAGUE_TYPE,
    visibility_type: "public",
  });
  if (created.error) return { ok: false, error: created.error };
  if (!created.league?.slug) return { ok: false, error: "Failed to provision a public league." };

  await syncPublicLeagueStatusBySlug(created.league.slug);
  const {
    data: { user: u },
  } = await supabase.auth.getUser();
  if (u?.id) await markPublicLeagueJoinPending(created.league.slug, u.id);
  return {
    ok: true,
    league_slug: created.league.slug,
    message:
      "No open public league was available, so we started a new one for you — you are the GM. Build your $100 roster before Monday RAW (5 PM PT).",
  };
}

export async function closeExpiredPublicLeagues(): Promise<void> {
  const admin = getAdminClient();
  if (!admin) return;
  const nowIso = new Date().toISOString();
  const { data: rows } = await admin
    .from("leagues")
    .select("id, slug, visibility_type, public_status, league_type, season_slug, registration_closes_at")
    .eq("visibility_type", "public")
    .in("public_status", ["open", "awaiting_minimum"])
    .not("registration_closes_at", "is", null)
    .lte("registration_closes_at", nowIso);

  for (const row of rows ?? []) {
    const id = (row as { id: string }).id;
    const slug = (row as { slug?: string }).slug;
    if (!slug) continue;

    await purgeUnplacedPublicLeagueMembersIfRegistrationClosed(
      id,
      row as {
        visibility_type?: string | null;
        league_type?: string | null;
        season_slug?: string | null;
        registration_closes_at?: string | null;
        public_status?: string | null;
      }
    );

    const memberCount = await countPlacedLeagueMembers(
      admin,
      id,
      row as { visibility_type?: string; league_type?: string | null; season_slug?: string | null }
    );

    if (memberCount >= MIN_LEAGUE_TEAMS) {
      await admin.from("leagues").update({ public_status: "active" }).eq("id", id);
      await maybeAwardLeagueStartedXpBySlug(slug);
      continue;
    }

    const closesAt = (row as { registration_closes_at?: string | null }).registration_closes_at;
    if (!closesAt) continue;
    const extended = extendPublicLeagueRegistrationOneWeek(closesAt);
    await admin
      .from("leagues")
      .update({
        registration_closes_at: extended.registration_closes_at,
        start_date: extended.season_start_ymd,
        end_date: extended.season_end_ymd,
        public_status: publicLeagueStatusForMemberCount(memberCount),
      })
      .eq("id", id);
  }
}

export async function syncPublicLeagueStatusBySlug(slug: string): Promise<void> {
  await closeExpiredPublicLeagues();
  const admin = getAdminClient();
  if (!admin || !slug) return;
  const { data: league } = await admin
    .from("leagues")
    .select(
      "id, visibility_type, max_teams, draft_status, league_type, season_slug, start_date, end_date, registration_closes_at, public_status"
    )
    .eq("slug", slug)
    .maybeSingle();
  const row = league as {
    id?: string;
    visibility_type?: string | null;
    max_teams?: number | null;
    draft_status?: string | null;
    league_type?: string | null;
    season_slug?: string | null;
    start_date?: string | null;
    end_date?: string | null;
    registration_closes_at?: string | null;
    public_status?: string | null;
  } | null;
  if (!row?.id || row.visibility_type !== "public") return;

  await purgeUnplacedPublicLeagueMembersIfRegistrationClosed(row.id, row);

  const memberCount = await countPlacedLeagueMembers(admin, row.id, row);
  const draftStatus = String(row.draft_status ?? "not_started");
  const publicSalaryCap = isPublicSalaryCapLeague(row);
  const cap = publicSalaryCap ? null : row.max_teams ?? 6;

  const updatePayload: Record<string, unknown> = {};

  if (publicSalaryCap) {
    if (!isPublicLeagueRegistrationOpen(row)) {
      if (memberCount >= MIN_LEAGUE_TEAMS) {
        updatePayload.public_status = "active";
      } else if (row.registration_closes_at) {
        const extended = extendPublicLeagueRegistrationOneWeek(row.registration_closes_at);
        updatePayload.registration_closes_at = extended.registration_closes_at;
        updatePayload.start_date = extended.season_start_ymd;
        updatePayload.end_date = extended.season_end_ymd;
        updatePayload.public_status = publicLeagueStatusForMemberCount(memberCount);
      }
    } else {
      updatePayload.public_status = publicLeagueStatusForMemberCount(memberCount);
    }
  } else {
    const status =
      draftStatus === "in_progress" || draftStatus === "ready_for_review" || draftStatus === "completed"
        ? "active"
        : cap != null && memberCount >= cap
          ? "full"
          : memberCount >= MIN_LEAGUE_TEAMS
            ? "open"
            : "awaiting_minimum";
    updatePayload.public_status = status;
  }

  await admin.from("leagues").update(updatePayload).eq("id", row.id);
  await maybeAwardLeagueStartedXpBySlug(slug);
}

// --- Commissioner manual rosters (league_rosters) ---

export type LeagueRosterEntry = {
  wrestler_id: string;
  contract: string | null;
  /** YYYY-MM-DD when added (for matchup display). */
  acquired_at?: string;
  /** YYYY-MM-DD when dropped (for matchup display). */
  released_at?: string | null;
  /** When set, used with `formatRosterMoveDateTimePt` for FA 5pm PT cutoff display. */
  acquired_at_ts?: string | null;
  released_at_ts?: string | null;
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
 * Cached per request when several modules load rosters for the same league.
 */
export const getRostersForLeague = cacheFn(
  async (leagueId: string): Promise<Record<string, LeagueRosterEntry[]>> => {
    const { supabase, user } = await getServerAuth();
    const { data: leagueRow } = await supabase
      .from("leagues")
      .select("draft_status, league_type")
      .eq("id", leagueId)
      .maybeSingle();
    const draftStatus = (leagueRow as { draft_status?: string } | null)?.draft_status ?? "not_started";
    const leagueType = (leagueRow as { league_type?: string | null } | null)?.league_type ?? null;

    let isSiteAdmin = false;
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_site_admin")
        .eq("id", user.id)
        .maybeSingle();
      isSiteAdmin = Boolean((profile as { is_site_admin?: boolean | null } | null)?.is_site_admin);
    }

    if (draftStatus === "ready_for_review" && !isSiteAdmin) {
      return {};
    }
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

    if (leagueUsesSalaryCap(leagueType) && !isSiteAdmin) {
      const setupCompleteByUserId = await getSalaryCapRosterSetupCompleteByUserId(supabase, leagueId);
      return filterRostersForSalaryCapSetupVisibility(
        byUser,
        leagueType,
        setupCompleteByUserId,
        user?.id ?? null,
        isSiteAdmin
      );
    }

    return byUser;
  }
);

/**
 * Same as getRostersForLeague but uses service role so all teams' rosters are returned.
 * Use in autopick/cron so draft state is correct regardless of RLS.
 * Pass `adminClient` when you already hold a service-role client (avoids a redundant lookup).
 */
export async function getRostersForLeagueAdmin(
  leagueId: string,
  adminClient?: ReturnType<typeof getAdminClient>
): Promise<Record<string, LeagueRosterEntry[]>> {
  const admin = adminClient ?? getAdminClient();
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
 * Cached per request — matchup code often reads stints several times for the same league.
 */
export const getRosterStintsForLeague = cacheFn(
  async (leagueId: string): Promise<LeagueRosterStint[]> => {
    const { supabase } = await getServerAuth();
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
);

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
 * Returns acquired_at / released_at and optional *_ts for matchup display (FA cutoff transparency).
 * Ordered by acquired_at per user.
 */
export const getRostersForLeagueForWeek = cacheFn(
  async (
    leagueId: string,
    weekStartMonday: string
  ): Promise<Record<string, LeagueRosterEntry[]>> => {
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
        acquired_at_ts: s.acquired_at_ts ? String(s.acquired_at_ts) : null,
        released_at_ts: s.released_at_ts ? String(s.released_at_ts) : null,
      });
    }
    for (const arr of Object.values(byUser)) {
      arr.sort(
        (a, b) =>
          (a.acquired_at ?? "").localeCompare(b.acquired_at ?? "") ||
          a.wrestler_id.localeCompare(b.wrestler_id)
      );
    }

    const { supabase, user } = await getServerAuth();
    const { data: leagueRow } = await supabase
      .from("leagues")
      .select("league_type")
      .eq("id", leagueId)
      .maybeSingle();
    const leagueType = (leagueRow as { league_type?: string | null } | null)?.league_type ?? null;
    if (leagueUsesSalaryCap(leagueType)) {
      let isSiteAdmin = false;
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("is_site_admin")
          .eq("id", user.id)
          .maybeSingle();
        isSiteAdmin = Boolean((profile as { is_site_admin?: boolean | null } | null)?.is_site_admin);
      }
      if (!isSiteAdmin) {
        const setupCompleteByUserId = await getSalaryCapRosterSetupCompleteByUserId(supabase, leagueId);
        return filterRostersForSalaryCapSetupVisibility(
          byUser,
          leagueType,
          setupCompleteByUserId,
          user?.id ?? null,
          isSiteAdmin
        );
      }
    }

    return byUser;
  }
);

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
  acquiredAt?: string | null,
  options?: { skipMainBrandPoolCheck?: boolean }
): Promise<{ error?: string }> {
  const { supabase, user } = await getServerAuth();
  if (!user) return { error: "Not authenticated" };

  const wid = String(wrestlerId).trim();
  if (!wid) return { error: "Wrestler is required" };
  const equivalentIds = [...new Set(draftEquivalentSlugs(wid).map((s) => s.trim()).filter(Boolean))];

  const { data: leagueTypeRow } = await supabase
    .from("leagues")
    .select("league_type, salary_cap_budget")
    .eq("id", leagueId)
    .maybeSingle();
  const leagueType = (leagueTypeRow as { league_type?: string | null } | null)?.league_type ?? null;
  const isSalaryCap = leagueType === "salary_cap";

  // Keep dual-identity wrestlers mutually exclusive across faction rosters (not in salary cap leagues).
  if (!isSalaryCap && equivalentIds.length > 0) {
    const { data: leagueRows } = await supabase
      .from("league_rosters")
      .select("user_id, wrestler_id")
      .eq("league_id", leagueId)
      .is("released_at", null)
      .in("wrestler_id", equivalentIds);
    const existing = (leagueRows ?? []) as { user_id: string; wrestler_id: string }[];
    const conflict = existing.find((r) => r.user_id !== userId);
    if (conflict) {
      return { error: "That wrestler (or an alter ego of that wrestler) is already on another faction roster." };
    }
  }

  const rules = await getRosterRulesForLeagueId(supabase, leagueId);

  if (isSalaryCap) {
    const { validateSalaryCapAdd } = await import("@/lib/salaryCap");
    const capCheck = await validateSalaryCapAdd(supabase, leagueId, userId, wid);
    if (capCheck.error) return { error: capCheck.error };
  }

  let brandForPool: string | null = null;

  if (rules) {
    const { data: currentRows } = await supabase
      .from("league_rosters")
      .select("wrestler_id")
      .eq("league_id", leagueId)
      .eq("user_id", userId)
      .is("released_at", null);
    const currentIds = (currentRows ?? []).map((r) => r.wrestler_id);
    if (currentIds.includes(wid)) return { error: "That wrestler is already on this roster." };
    if (equivalentIds.some((id) => currentIds.includes(id))) {
      return { error: "That wrestler (or an alter ego of that wrestler) is already on this roster." };
    }
    const maxRoster = rules.rosterSize;
    if (isSalaryCap) {
      const capMax = maxRoster > 0 ? maxRoster : SALARY_CAP_MAX_ROSTER_SIZE;
      if (currentIds.length >= capMax) {
        return { error: `Roster full (max ${capMax} wrestlers). Drop someone first.` };
      }
    } else if (currentIds.length >= maxRoster) {
      return { error: `Roster full (max ${maxRoster} wrestlers).` };
    }

    const wrestlerIdsToFetch = [...new Set([...currentIds, wid])];
    const { data: wrestlerRows } = await supabase
      .from("wrestlers")
      .select("id, gender, brand")
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

    if (
      !isSalaryCap &&
      newCount === rules.rosterSize &&
      (newFemale < rules.minFemale || newMale < rules.minMale)
    ) {
      return {
        error: `Roster must have at least ${rules.minFemale} female and ${rules.minMale} male wrestlers when full. Current would be ${newFemale}F / ${newMale}M.`,
      };
    }

    const newRow = (wrestlerRows ?? []).find((r) => r.id === wid) as { brand?: string | null } | undefined;
    brandForPool = newRow?.brand ?? null;
  } else {
    const { data: oneW } = await supabase.from("wrestlers").select("brand").eq("id", wid).maybeSingle();
    brandForPool = (oneW as { brand?: string | null } | null)?.brand ?? null;
  }

  if (!options?.skipMainBrandPoolCheck) {
    const poolRes = await supabase.from("leagues").select("include_nxt, league_type").eq("id", leagueId).maybeSingle();
    const includeNxt =
      poolRes.error && /include_nxt/i.test(poolRes.error.message ?? "")
        ? false
        : leagueIncludesNxt(poolRes.data as { include_nxt?: boolean | null } | null);
    if (!isMainBrandWrestlerRosterForLeague(brandForPool, { includeNxt })) {
      return {
        error: includeNxt
          ? "This wrestler is not in the eligible pool (Raw, SmackDown, or NXT only)."
          : "This wrestler is not in the eligible pool (Raw and SmackDown only). For Head-to-Head test leagues, turn on Include NXT (site admin) to add NXT roster talent.",
      };
    }
  }

  const admin = getAdminClient();
  if (useServiceRole && !admin) {
    return { error: "Server misconfiguration: SUPABASE_SERVICE_ROLE_KEY is not set. Draft picks need this. Add it in .env and Netlify environment variables." };
  }
  const insertClient = useServiceRole && admin ? admin : supabase;
  const clock = new Date();
  const acquiredDate =
    (acquiredAt && /^\d{4}-\d{2}-\d{2}$/.test(acquiredAt.trim()) ? acquiredAt.trim() : null) ||
    rosterCivilDateYmd(clock);
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
  const { supabase, user } = await getServerAuth();
  if (!user) return { error: "Not authenticated" };

  const clock = new Date();
  const releasedDate =
    (releasedAt && /^\d{4}-\d{2}-\d{2}$/.test(releasedAt.trim()) ? releasedAt.trim() : null) ||
    rosterCivilDateYmd(clock);
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
  leagueId: string,
  supabaseOverride?: SupabaseClient
): Promise<{
  pointsBySlug: PointsBySlug;
  pointsByOwner: Record<string, number>;
  pointsByOwnerByWrestler: Record<string, Record<string, number>>;
}> {
  const supabase = supabaseOverride ?? (await getServerAuth()).supabase;
  const { data: league } = await supabase
    .from("leagues")
    .select("id, start_date, end_date, draft_date, season_slug, include_nxt, league_type")
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
    .in("status", [...EVENT_STATUSES_FOR_SCORING])
    .order("date", { ascending: true })
    .limit(SCORING_EVENTS_FETCH_LIMIT);

  const { data: eventsWithStart, error: eventsErr } = await eventsSelectWithStart;
  const events =
    eventsWithStart ??
    (eventsErr && /column.*broadcast_start_ts does not exist/i.test(eventsErr.message ?? "")
      ? (
          await supabase
            .from("events")
            .select("id, name, date, matches")
            .in("status", [...EVENT_STATUSES_FOR_SCORING])
            .order("date", { ascending: true })
            .limit(SCORING_EVENTS_FETCH_LIMIT)
        ).data ?? []
      : []);

  const filtered = (events ?? []).filter((e) => {
    const d = (e.date ?? "").toString().slice(0, 10);
    if (start && d < start) return false;
    if (end && d > end) return false;
    return true;
  });

  const { data: wrestlerBrandRows } = await supabase.from("wrestlers").select("id, brand");
  const brandBySlug = brandByWrestlerSlugFromRows((wrestlerBrandRows ?? []) as { id: string; brand: string | null }[]);

  const pointsBySlug = aggregateWrestlerPoints(filtered, brandBySlug) as PointsBySlug;
  const stints = supabaseOverride
    ? ((
        await supabase
          .from("league_rosters")
          .select(
            "user_id, wrestler_id, contract, acquired_at, released_at, acquired_at_ts, released_at_ts"
          )
          .eq("league_id", leagueId)
          .order("acquired_at", { ascending: true })
      ).data ?? []
      ).map((r) => {
        const row = r as {
          user_id: string;
          wrestler_id: string;
          contract: string | null;
          acquired_at: string;
          released_at: string | null;
          acquired_at_ts?: string | null;
          released_at_ts?: string | null;
        };
        return {
          user_id: row.user_id,
          wrestler_id: row.wrestler_id,
          contract: row.contract,
          acquired_at: String(row.acquired_at ?? "").slice(0, 10),
          released_at: row.released_at ? String(row.released_at).slice(0, 10) : null,
          acquired_at_ts: row.acquired_at_ts ? String(row.acquired_at_ts) : null,
          released_at_ts: row.released_at_ts ? String(row.released_at_ts) : null,
        };
      })
    : await getRosterStintsForLeague(leagueId);

  const activityRows = await fetchLeagueActivityForStintEnrichment(supabase, leagueId);
  const scoringStints = enrichRosterStintsWithActivityTimestamps(stints, activityRows);

  let wrestlerDisplayNames: Record<string, string> = {};
  if (supabaseOverride) {
    const ids = [...new Set(scoringStints.map((s) => s.wrestler_id).filter(Boolean))];
    if (ids.length) {
      const { data: wrestlerNames } = await supabase
        .from("wrestlers")
        .select("id, name")
        .in("id", ids);
      wrestlerDisplayNames = Object.fromEntries(
        (wrestlerNames ?? []).map((w) => {
          const row = w as { id: string; name: string | null };
          return [row.id, row.name ?? row.id];
        })
      );
    }
  } else {
    wrestlerDisplayNames = await getWrestlerDisplayNamesByIds(scoringStints.map((s) => s.wrestler_id));
  }
  const rosterWrestlerIds = [...new Set(scoringStints.map((s) => s.wrestler_id))];
  const { data: rosterWrestlerRows } = rosterWrestlerIds.length
    ? await supabase.from("wrestlers").select("id, brand").in("id", rosterWrestlerIds)
    : { data: [] as Array<{ id: string; brand: string | null }> };
  const nxtRosterByWrestlerId: Record<string, boolean> = {};
  for (const w of rosterWrestlerRows ?? []) {
    nxtRosterByWrestlerId[w.id] = wrestlerRosterFromBrand(w.brand) === "NXT";
  }
  const enforceMainRosterOnlyForNxt =
    (league.season_slug ?? null) === ROAD_TO_SUMMERSLAM_SEASON_SLUG && !leagueIncludesNxt(league);
  const includeNxtLeague = leagueIncludesNxt(league);
  /** Include-NXT leagues score main-roster wrestlers on NXT cards; omit brand filter (see skipMainRosterNxtSeasonPoints). */
  const brandBySlugForEventScoring = includeNxtLeague ? null : brandBySlug;
  const sharedWrestlerPool = leagueUsesSalaryCap(
    (league as { league_type?: string | null }).league_type
  );
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
    (e) => getEventBroadcastStartMs(e) != null
  );
  for (const event of sortedEvents) {
    const eventDate = (event.date ?? "").toString().slice(0, 10);
    const eventType = classifyEventType(event.name ?? "", event.id ?? "");
    const { pointsBySlug: eventPoints, callUpBySlug, updatedCarryOver } = getPointsForSingleEvent(
      event,
      kotrCarryOver,
      brandBySlugForEventScoring
    );
    kotrCarryOver = updatedCarryOver;
    const bestStintByWrestlerId: Record<string, typeof scoringStints[number]> = {};
    // When `broadcast_start_ts` exists: calendar overlap + timestamp vs broadcast (see rosterStintEventWindow).
    // When absent: legacy end-of-event-day UTC vs shifted stint boundaries (+ optional ts alignment).
    const eventEndOfDayMs = Date.parse(`${eventDate}T23:59:59.999Z`);
    const eventStartMs = getEventBroadcastStartMs(event);
    const useBroadcastStart = eventStartMs != null && Number.isFinite(eventStartMs);
    const eventMs = eventEndOfDayMs;
    const broadcastStartMs = useBroadcastStart ? eventStartMs! : undefined;

    // Draft leagues: overlapping stints for the same wrestler award one owner (earliest acquisition wins).
    // Salary cap: multiple factions may roster the same wrestler — each active stint earns points.
    if (!sharedWrestlerPool) {
      for (const stint of scoringStints) {
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
    }

    for (const stint of scoringStints) {
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

      if (!sharedWrestlerPool && bestStintByWrestlerId[stint.wrestler_id] !== stint) continue;
      if (
        enforceMainRosterOnlyForNxt &&
        eventPointsForRosterStint(callUpBySlug, stint.wrestler_id, wrestlerDisplayNames[stint.wrestler_id], eventDate) <= 0 &&
        nxtRosterByWrestlerId[stint.wrestler_id] &&
        (eventType === EVENT_TYPES.NXT || String(eventType).startsWith("nxt-"))
      ) {
        continue;
      }

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

  // Title-hold belt points: weekly (RTS / RTSS; after all week events complete) or legacy calendar month-ends.
  try {
    const [histResult, changesResult] = await Promise.all([
      supabase.from("championship_history").select("*"),
      supabase
        .from(CHAMPIONSHIP_CHANGES_TABLE_NAME)
        .select("championship_type, champion, champion_slug, date")
        .order("date", { ascending: true }),
    ]);
    const histRows = histResult.data;
    const tableReignsForBelt = (histRows ?? [])
      .map((row) => normalizeChampionshipHistoryRow(row as Record<string, unknown>))
      .sort((a, b) => {
        const ax = (a.won_date ?? a.start_date ?? "").slice(0, 10);
        const bx = (b.won_date ?? b.start_date ?? "").slice(0, 10);
        return ax.localeCompare(bx);
      });
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
    const reigns = mergeReigns(tableReignsForBelt, [...inferredReigns, ...changesReigns]);
    const seasonSlug = (league as { season_slug?: string | null }).season_slug ?? null;
    const useWeeklyBelt = leagueUsesWeeklyPstBeltHold(seasonSlug);

    if (useWeeklyBelt) {
      const beltFirstWeekEnd = firstEligibleWeekEndSundayForLeagueStart(start);
      const lastWeekCap = beltScoringLastWeekEndSundayInclusive(leagueEndYmd || undefined);
      const { data: beltWeekGateRows } = await supabase
        .from("events")
        .select("date, status")
        .in("status", [...EVENT_STATUSES_FOR_WEEK_SCHEDULE])
        .gte("date", start)
        .lte("date", leagueEndYmd || "2099-12-31")
        .order("date", { ascending: true })
        .limit(SCORING_EVENTS_FETCH_LIMIT);
      const weekEnds = getCompletedWeekEndSundaysForBeltScoring(beltFirstWeekEnd, lastWeekCap, Date.now(), {
        leagueStartYmd: start,
        leagueEndYmd: leagueEndYmd || "2099-12-31",
        events: (beltWeekGateRows ?? []) as Array<{ date: string | null; status: string | null }>,
      });
      for (const lockYmd of weekEnds) {
        const weekEndSun = weekEndSundayContaining(lockYmd);
        const lockEvent = sortedEvents.find((e) => String(e.date ?? "").slice(0, 10) === lockYmd);
        const lockBroadcastMs = lockEvent ? getEventBroadcastStartMs(lockEvent) : null;
        const beltBySlug = computeWeeklyBeltHoldPointsForWeekEndSunday(
          reigns,
          lockYmd,
          beltFirstWeekEnd,
          weekEndSun
        );
        for (const stint of scoringStints) {
          if (
            !rosterStintActiveForWeeklyBeltHold({
              stint,
              weekEndYmd: lockYmd,
              useBroadcastStart: useBroadcastForMonthlyBelt,
              broadcastStartMs: lockBroadcastMs ?? undefined,
            })
          ) {
            continue;
          }
          const name = wrestlerDisplayNames[stint.wrestler_id];
          const pts = sumMonthlyBeltPointsForStint(beltBySlug, stint.wrestler_id, name, lockYmd);
          if (pts <= 0) continue;
          pointsByOwner[stint.user_id] = (pointsByOwner[stint.user_id] ?? 0) + pts;
          if (!pointsByOwnerByWrestler[stint.user_id]) pointsByOwnerByWrestler[stint.user_id] = {};
          pointsByOwnerByWrestler[stint.user_id][stint.wrestler_id] =
            (pointsByOwnerByWrestler[stint.user_id][stint.wrestler_id] ?? 0) + pts;
        }
      }
    } else {
      const firstM = firstLegacyCalendarMonthEndEligibleForLeagueStart(start);
      const lastM = beltScoringLastMonthEndInclusive(leagueEndYmd || undefined);
      const monthEnds = getCompletedMonthEndsForBeltScoring(firstM, lastM, Date.now());
      const seasonEndSnapshot = legacySeasonEndBeltSnapshotYmd(leagueEndYmd || undefined);
      if (
        seasonEndSnapshot &&
        seasonEndSnapshot >= firstM &&
        isPastEndOfDayPst(seasonEndSnapshot) &&
        !monthEnds.includes(seasonEndSnapshot)
      ) {
        monthEnds.push(seasonEndSnapshot);
        monthEnds.sort((a, b) => a.localeCompare(b));
      }
      const currentChampionsSnapshotBySlug =
        seasonEndSnapshot && monthEnds.includes(seasonEndSnapshot)
          ? await getCurrentChampionsMonthlyBeltBySlug(supabase)
          : null;
      for (const monthEnd of monthEnds) {
        if (shouldSkipJulyMonthEndBeltForRts2026(monthEnd, leagueEndYmd)) continue;
        const beltBySlug = computeEndOfMonthBeltPointsForSingleMonth(reigns, monthEnd, firstM);
        if (seasonEndSnapshot && monthEnd === seasonEndSnapshot && currentChampionsSnapshotBySlug) {
          for (const [slug, pts] of Object.entries(currentChampionsSnapshotBySlug)) {
            if (!Number.isFinite(pts) || pts <= 0) continue;
            beltBySlug[slug] = Math.max(beltBySlug[slug] ?? 0, pts);
          }
        }
        for (const stint of scoringStints) {
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
