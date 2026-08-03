import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { RTS_2026_LEAGUE_END_DATE } from "@/lib/beltRts2026JulyDeferral";
import { getWeeksInRange } from "@/lib/fantasyWeekBounds";
import {
  getLeagueWeeklyMatchups,
  getPlayoffBracket,
  getPointsByOwnerForLeagueWithBonuses,
  getXpSeededMemberUserIds,
} from "@/lib/leagueMatchups";
import {
  PUBLIC_LEAGUE_CHAMPIONSHIP_BANNER_SRC,
  ROAD_TO_SUMMERSLAM_BANNER_SRC,
  ROAD_TO_SUMMERSLAM_SEASON_SLUG,
  getLeagueSeasonBelt,
} from "@/lib/leagueStructure";
import { isPastEndOfDayPst } from "@/lib/pstCivilTime";
import { applyLeaguePlacementXp, type LeagueTeamCount } from "@/lib/xp/leaguePlacementGrants";

/** Season key for RTSS 2026 placements + XP idempotency. */
export const RTSS_2026_SEASON_KEY = "road-to-summerslam-2026";

/** Build a stable season_key from season_slug + end year. */
export function seasonKeyForLeague(league: {
  season_slug?: string | null;
  end_date?: string | null;
}): string {
  const slug = String(league.season_slug ?? "").trim() || "season";
  const year = (league.end_date ?? "").slice(0, 4);
  if (slug === ROAD_TO_SUMMERSLAM_SEASON_SLUG && year === "2026") return RTSS_2026_SEASON_KEY;
  return year ? `${slug}-${year}` : slug;
}

export type LeagueForPlacementResolve = {
  id: string;
  name: string | null;
  slug: string | null;
  league_type: string | null;
  draft_type?: string | null;
  season_slug: string | null;
  start_date: string | null;
  end_date: string | null;
  draft_date: string | null;
  draft_status: string | null;
  max_teams: number | null;
  visibility_type: string | null;
  is_archived?: boolean | null;
};

export type ResolvedLeagueChampion = {
  userId: string;
  points: number;
  teamCount: number;
  method: "points" | "h2h_playoff";
};

export type LeagueSeasonPlacementRow = {
  league_id: string;
  season_key: string;
  user_id: string;
  placement: number;
  points: number;
  determined_at: string;
};

export type ChampionDisplayRow = {
  userId: string;
  displayName: string;
  leagueId: string;
  leagueName: string;
  leagueSlug: string;
  visibility: "public" | "private";
  points: number;
  beltSrc: string;
  beltAlt: string;
  seasonKey: string;
  seasonSlug: string | null;
};

function asTeamCount(n: number): LeagueTeamCount | null {
  if (n === 3 || n === 4 || n === 5 || n === 6) return n;
  return null;
}

function pickPointsChampion(pointsByUserId: Record<string, number>): { userId: string; points: number } | null {
  const ranked = Object.entries(pointsByUserId)
    .map(([userId, points]) => ({ userId, points: Number(points || 0) }))
    .sort((a, b) => b.points - a.points || a.userId.localeCompare(b.userId));
  return ranked[0] ?? null;
}

/**
 * Resolve the champion for one league after season end.
 * Returns null when the season is not over yet, or H2H final is not decided.
 */
export async function resolveLeagueChampion(
  league: LeagueForPlacementResolve,
  admin: SupabaseClient
): Promise<ResolvedLeagueChampion | null> {
  const endYmd = (league.end_date ?? "").slice(0, 10);
  if (!endYmd || !isPastEndOfDayPst(endYmd)) return null;
  if ((league.draft_status ?? "") !== "completed") return null;

  const { data: memberRows, error: memberErr } = await admin
    .from("league_members")
    .select("user_id")
    .eq("league_id", league.id);
  if (memberErr || !memberRows?.length) return null;

  const memberUserIds = (memberRows as Array<{ user_id: string }>)
    .map((r) => r.user_id)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
  if (memberUserIds.length < 2) return null;

  const pointsByUserId = await getPointsByOwnerForLeagueWithBonuses(league.id, admin);
  const leagueType = league.league_type ?? null;

  if (leagueType === "head_to_head" || leagueType === "combo") {
    const leagueStart = (league.draft_date || league.start_date) ?? "";
    const leagueEnd = league.end_date ?? "";
    if (!leagueStart || !leagueEnd) return null;
    const weeks = getWeeksInRange(leagueStart, leagueEnd);
    if (weeks.length === 0) return null;

    const [matchups, seededMemberUserIds] = await Promise.all([
      getLeagueWeeklyMatchups(league.id, admin),
      getXpSeededMemberUserIds(memberUserIds, admin),
    ]);
    const bracket = getPlayoffBracket({
      weekStarts: weeks,
      memberUserIds,
      seededMemberUserIds,
      maxTeams: league.max_teams ?? null,
      draftStatus: league.draft_status ?? null,
      weeklyResults: matchups,
    });
    const champUserId = bracket?.champion?.userId ?? null;
    if (!champUserId) return null;
    return {
      userId: champUserId,
      points: Number(pointsByUserId[champUserId] ?? 0),
      teamCount: memberUserIds.length,
      method: "h2h_playoff",
    };
  }

  const top = pickPointsChampion(pointsByUserId);
  if (!top) return null;
  return {
    userId: top.userId,
    points: top.points,
    teamCount: memberUserIds.length,
    method: "points",
  };
}

export async function upsertLeagueChampionPlacement(
  admin: SupabaseClient,
  args: {
    leagueId: string;
    seasonKey: string;
    userId: string;
    points: number;
    placement?: number;
  }
): Promise<{ error: string | null }> {
  const placement = args.placement ?? 1;
  const { error } = await admin.from("league_season_placements").upsert(
    {
      league_id: args.leagueId,
      season_key: args.seasonKey,
      user_id: args.userId,
      placement,
      points: args.points,
      determined_at: new Date().toISOString(),
    },
    { onConflict: "league_id,season_key,placement" }
  );
  return { error: error?.message ?? null };
}

export async function listRtss2026EligibleLeagues(
  admin: SupabaseClient
): Promise<LeagueForPlacementResolve[]> {
  const { data, error } = await admin
    .from("leagues")
    .select(
      "id, name, slug, league_type, draft_type, season_slug, start_date, end_date, draft_date, draft_status, max_teams, visibility_type, is_archived"
    )
    .eq("season_slug", ROAD_TO_SUMMERSLAM_SEASON_SLUG)
    .eq("end_date", RTS_2026_LEAGUE_END_DATE)
    .eq("draft_status", "completed")
    .eq("is_archived", false);
  if (error || !data) return [];
  return data as LeagueForPlacementResolve[];
}

export async function hasChampionPlacement(
  admin: SupabaseClient,
  leagueId: string,
  seasonKey: string
): Promise<boolean> {
  const { data } = await admin
    .from("league_season_placements")
    .select("id")
    .eq("league_id", leagueId)
    .eq("season_key", seasonKey)
    .eq("placement", 1)
    .maybeSingle();
  return Boolean(data);
}

/**
 * Finalize one league: resolve champion, upsert placement, award XP when team count is 3–6.
 * Idempotent when a placement row already exists (still safe to re-upsert + XP).
 */
export async function finalizeLeagueChampionPlacement(
  admin: SupabaseClient,
  league: LeagueForPlacementResolve,
  opts?: { seasonKey?: string; dryRun?: boolean; force?: boolean }
): Promise<{
  status: "recorded" | "skipped" | "pending" | "error";
  champion?: ResolvedLeagueChampion;
  message: string;
}> {
  const seasonKey = opts?.seasonKey ?? RTSS_2026_SEASON_KEY;
  const dryRun = Boolean(opts?.dryRun);

  if (!opts?.force && (await hasChampionPlacement(admin, league.id, seasonKey))) {
    return { status: "skipped", message: `already recorded league=${league.slug ?? league.id}` };
  }

  const champion = await resolveLeagueChampion(league, admin);
  if (!champion) {
    return {
      status: "pending",
      message: `champion not ready league=${league.slug ?? league.id} (season not over or H2H final pending)`,
    };
  }

  if (dryRun) {
    return {
      status: "recorded",
      champion,
      message: `dry-run would record league=${league.slug ?? league.id} user=${champion.userId} pts=${champion.points} via=${champion.method}`,
    };
  }

  const { error } = await upsertLeagueChampionPlacement(admin, {
    leagueId: league.id,
    seasonKey,
    userId: champion.userId,
    points: champion.points,
    placement: 1,
  });
  if (error) {
    return { status: "error", champion, message: error };
  }

  const teamCount = asTeamCount(champion.teamCount);
  if (teamCount) {
    await applyLeaguePlacementXp(admin, {
      userId: champion.userId,
      leagueId: league.id,
      seasonKey,
      placement: 1,
      teamCount,
    });
  }

  return {
    status: "recorded",
    champion,
    message: `recorded league=${league.slug ?? league.id} user=${champion.userId} pts=${champion.points} via=${champion.method}`,
  };
}

/**
 * Resolve champion for a finished league without requiring draft_status=completed.
 * Used for historical/admin test leagues that ended with standings but odd draft flags.
 */
export async function resolveLeagueChampionAllowIncompleteDraft(
  league: LeagueForPlacementResolve,
  admin: SupabaseClient
): Promise<ResolvedLeagueChampion | null> {
  return resolveLeagueChampion({ ...league, draft_status: "completed" }, admin);
}

export async function finalizeAllRtss2026Champions(
  admin: SupabaseClient,
  opts?: { dryRun?: boolean; force?: boolean; leagueIds?: Set<string> | null }
): Promise<Array<{ leagueId: string; status: string; message: string }>> {
  const leagues = await listRtss2026EligibleLeagues(admin);
  const out: Array<{ leagueId: string; status: string; message: string }> = [];
  for (const league of leagues) {
    if (opts?.leagueIds && !opts.leagueIds.has(league.id)) continue;
    const result = await finalizeLeagueChampionPlacement(admin, league, {
      dryRun: opts?.dryRun,
      force: opts?.force,
      seasonKey: RTSS_2026_SEASON_KEY,
    });
    out.push({ leagueId: league.id, status: result.status, message: result.message });
  }
  return out;
}

function visibilityLabel(raw: string | null | undefined): "public" | "private" {
  return String(raw ?? "").trim().toLowerCase() === "public" ? "public" : "private";
}

async function loadDisplayNames(
  admin: SupabaseClient,
  userIds: string[]
): Promise<Map<string, string>> {
  const labels = new Map<string, string>();
  const unique = [...new Set(userIds)].filter(Boolean);
  for (let i = 0; i < unique.length; i += 100) {
    const chunk = unique.slice(i, i + 100);
    const { data } = await admin.from("profiles").select("id, display_name").in("id", chunk);
    for (const row of (data ?? []) as Array<{ id: string; display_name: string | null }>) {
      const name = row.display_name?.trim();
      labels.set(row.id, name || "Manager");
    }
  }
  return labels;
}

type PlacementJoinRow = {
  league_id: string;
  season_key: string;
  user_id: string;
  placement: number;
  points: number;
  leagues: {
    name: string | null;
    slug: string | null;
    visibility_type: string | null;
    season_slug: string | null;
    league_type: string | null;
    draft_type: string | null;
  } | null;
};

function toChampionDisplayRow(
  row: PlacementJoinRow,
  displayName: string
): ChampionDisplayRow | null {
  const league = row.leagues;
  if (!league?.slug) return null;
  const belt =
    getLeagueSeasonBelt({
      season_slug: league.season_slug,
      league_type: league.league_type,
      draft_type: league.draft_type,
    }) ??
    (league.season_slug === ROAD_TO_SUMMERSLAM_SEASON_SLUG
      ? { src: ROAD_TO_SUMMERSLAM_BANNER_SRC, alt: "Road to SummerSlam" }
      : { src: PUBLIC_LEAGUE_CHAMPIONSHIP_BANNER_SRC, alt: "League Championship" });
  return {
    userId: row.user_id,
    displayName,
    leagueId: row.league_id,
    leagueName: (league.name ?? "").trim() || league.slug,
    leagueSlug: league.slug,
    visibility: visibilityLabel(league.visibility_type),
    points: Number(row.points || 0),
    beltSrc: belt.src,
    beltAlt: belt.alt,
    seasonKey: row.season_key,
    seasonSlug: league.season_slug,
  };
}

/** Hub: all RTSS 2026 champions (public + private). */
export async function listSeasonChampionsForHub(
  admin: SupabaseClient,
  seasonKey: string = RTSS_2026_SEASON_KEY
): Promise<ChampionDisplayRow[]> {
  const { data, error } = await admin
    .from("league_season_placements")
    .select(
      "league_id, season_key, user_id, placement, points, leagues!inner(name, slug, visibility_type, season_slug, league_type, draft_type)"
    )
    .eq("season_key", seasonKey)
    .eq("placement", 1);
  if (error || !data) return [];

  const rows = data as unknown as PlacementJoinRow[];
  const names = await loadDisplayNames(
    admin,
    rows.map((r) => r.user_id)
  );
  const out: ChampionDisplayRow[] = [];
  for (const row of rows) {
    const display = toChampionDisplayRow(row, names.get(row.user_id) ?? "Manager");
    if (display) out.push(display);
  }
  out.sort(
    (a, b) =>
      b.points - a.points ||
      a.displayName.localeCompare(b.displayName) ||
      a.leagueName.localeCompare(b.leagueName)
  );
  return out;
}

/** Account: championship wins for one user (all seasons). */
export async function listUserChampionshipWins(
  admin: SupabaseClient,
  userId: string
): Promise<ChampionDisplayRow[]> {
  const { data, error } = await admin
    .from("league_season_placements")
    .select(
      "league_id, season_key, user_id, placement, points, leagues!inner(name, slug, visibility_type, season_slug, league_type, draft_type)"
    )
    .eq("user_id", userId)
    .eq("placement", 1)
    .order("determined_at", { ascending: false });
  if (error || !data) return [];

  const rows = data as unknown as PlacementJoinRow[];
  const names = await loadDisplayNames(admin, [userId]);
  const displayName = names.get(userId) ?? "Manager";
  const out: ChampionDisplayRow[] = [];
  for (const row of rows) {
    const display = toChampionDisplayRow(row, displayName);
    if (display) out.push(display);
  }
  return out;
}
