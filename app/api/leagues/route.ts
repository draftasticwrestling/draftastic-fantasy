import { NextResponse } from "next/server";
import { createLeague } from "@/lib/leagues";
import { getServerAuth } from "@/lib/supabase/serverAuth";
import { SALARY_CAP_LEAGUE_TYPE } from "@/lib/leagueStructure";
import {
  PUBLIC_SALARY_CAP_SEASON_SLUG,
  STANDARD_USER_CREATE_SEASON_SLUG,
  roadToWarGamesCreateOpen,
} from "@/lib/leagueSeasons";

/** Road to War Games private-league formats and team-count limits (matches create form). */
const R2WG_TEAM_RANGE: Record<string, { min: number; max: number }> = {
  season_overall: { min: 3, max: 6 },
  head_to_head: { min: 4, max: 8 },
};

/**
 * POST /api/leagues — create a new league.
 * Body: { name, season_slug?, season_year?, league_type?, max_teams?, include_nxt?, visibility_type? }
 *
 * Non-admin private creates follow the same Road to War Games rules as the Create a League
 * form: no access code, season locked to R2WG, TSP (3–6) or H2H (4–8), NXT always included.
 * Note: The primary UI uses a Server Action; this route is for programmatic use.
 */
export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body. Expected { name, season_slug?, league_type?, max_teams?, ... }." },
        { status: 400 }
      );
    }
    const name =
      typeof body === "object" && body !== null && "name" in body
        ? String((body as { name?: unknown }).name ?? "").trim()
        : "";
    const season_slug =
      typeof body === "object" && body !== null && "season_slug" in body
        ? String((body as { season_slug?: unknown }).season_slug ?? "").trim()
        : "";
    const season_year =
      typeof body === "object" && body !== null && "season_year" in body
        ? Number((body as { season_year?: unknown }).season_year)
        : NaN;
    const league_type_raw =
      typeof body === "object" && body !== null && "league_type" in body
        ? String((body as { league_type?: unknown }).league_type ?? "").trim()
        : "";
    const max_teams_raw =
      typeof body === "object" && body !== null && "max_teams" in body
        ? Number((body as { max_teams?: unknown }).max_teams)
        : NaN;
    const include_nxt_raw =
      typeof body === "object" && body !== null && "include_nxt" in body
        ? (body as { include_nxt?: unknown }).include_nxt
        : false;
    const include_nxt =
      include_nxt_raw === true || include_nxt_raw === "true" || include_nxt_raw === 1;
    const visibility_type_raw =
      typeof body === "object" && body !== null && "visibility_type" in body
        ? String((body as { visibility_type?: unknown }).visibility_type ?? "").trim().toLowerCase()
        : "private";
    const visibility_type = visibility_type_raw === "public" ? "public" : "private";
    const isPublicCreate = visibility_type === "public";

    const { supabase, user } = await getServerAuth();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_site_admin")
      .eq("id", user.id)
      .maybeSingle();
    const isSiteAdmin = Boolean((profile as { is_site_admin?: boolean | null } | null)?.is_site_admin);

    if (isPublicCreate) {
      if (!isSiteAdmin) {
        return NextResponse.json(
          { error: "Public leagues cannot be created. Join an open public league from Play Now instead." },
          { status: 403 }
        );
      }
    } else if (!isSiteAdmin) {
      // Standard private create: Road to War Games, no access code.
      if (!roadToWarGamesCreateOpen()) {
        return NextResponse.json(
          {
            error:
              "Road to War Games league creation is closed for this season (new leagues must start at least six weeks before Survivor Series: War Games).",
          },
          { status: 403 }
        );
      }
      if (season_slug && season_slug !== STANDARD_USER_CREATE_SEASON_SLUG) {
        return NextResponse.json(
          { error: "New private leagues use the Road to War Games season." },
          { status: 400 }
        );
      }
      const league_type = league_type_raw || "season_overall";
      const range = R2WG_TEAM_RANGE[league_type];
      if (!range) {
        return NextResponse.json(
          {
            error:
              "Choose Total Season Points or Head-to-Head. Combo, Legacy, and Salary Cap private leagues are coming soon.",
          },
          { status: 400 }
        );
      }
      const teamCount = Number.isFinite(max_teams_raw)
        ? Math.floor(max_teams_raw)
        : range.min;
      if (teamCount < range.min || teamCount > range.max) {
        const label = league_type === "head_to_head" ? "Head-to-Head" : "Total Season Points";
        return NextResponse.json(
          { error: `${label} leagues use ${range.min}–${range.max} factions.` },
          { status: 400 }
        );
      }
      if (!name) {
        return NextResponse.json({ error: "Enter a league name." }, { status: 400 });
      }

      const { league, error } = await createLeague({
        name,
        season_slug: STANDARD_USER_CREATE_SEASON_SLUG,
        season_year,
        league_type,
        max_teams: teamCount,
        include_nxt: true,
        visibility_type: "private",
      });
      if (error) {
        return NextResponse.json({ error }, { status: 400 });
      }
      return NextResponse.json({ league });
    }

    // Site-admin path (private or public).
    const ADMIN_TYPES = new Set(["season_overall", "head_to_head", "combo", "legacy", "salary_cap"]);
    const league_type = isPublicCreate
      ? SALARY_CAP_LEAGUE_TYPE
      : league_type_raw
        ? ADMIN_TYPES.has(league_type_raw)
          ? league_type_raw
          : null
        : "season_overall";
    if (!isPublicCreate && league_type_raw && !league_type) {
      return NextResponse.json({ error: "Invalid league_type." }, { status: 400 });
    }
    if (include_nxt && league_type !== "head_to_head" && league_type !== "salary_cap") {
      return NextResponse.json(
        { error: "include_nxt requires league_type head_to_head or salary_cap." },
        { status: 400 }
      );
    }
    const max_teams = Number.isFinite(max_teams_raw)
      ? Math.min(16, Math.max(3, Math.floor(max_teams_raw)))
      : undefined;

    const { league, error } = await createLeague({
      name: isPublicCreate ? "Public League" : name,
      season_slug: isPublicCreate
        ? PUBLIC_SALARY_CAP_SEASON_SLUG
        : season_slug || STANDARD_USER_CREATE_SEASON_SLUG,
      season_year,
      league_type: isPublicCreate ? SALARY_CAP_LEAGUE_TYPE : league_type ?? "season_overall",
      max_teams: isPublicCreate ? null : max_teams,
      include_nxt: isPublicCreate ? true : include_nxt,
      visibility_type,
    });
    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }
    return NextResponse.json({ league });
  } catch (err) {
    console.error("POST /api/leagues", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
