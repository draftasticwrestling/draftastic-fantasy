import { NextResponse } from "next/server";
import { createLeague } from "@/lib/leagues";
import { getServerAuth } from "@/lib/supabase/serverAuth";
import {
  consumeLeagueCreationAccessCode,
  leagueCreationAccessIsConfigured,
} from "@/lib/leagueCreationAccess";
import { SALARY_CAP_LEAGUE_TYPE } from "@/lib/leagueStructure";
import { PUBLIC_SALARY_CAP_SEASON_SLUG } from "@/lib/leagueSeasons";

/**
 * POST /api/leagues — create a new league. Body: { name, season_slug, season_year?, access_code? }
 * season_year defaults to the current calendar year if omitted or invalid.
 * Note: The "Create a league" form uses a Server Action instead; this route is for programmatic use.
 */
export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body. Expected { name, season_slug, season_year?, access_code? }." },
        { status: 400 }
      );
    }
    const name = typeof body === "object" && body !== null && "name" in body
      ? String((body as { name?: unknown }).name ?? "").trim()
      : "";
    const season_slug = typeof body === "object" && body !== null && "season_slug" in body
      ? String((body as { season_slug?: unknown }).season_slug ?? "").trim()
      : "";
    const season_year = typeof body === "object" && body !== null && "season_year" in body
      ? Number((body as { season_year?: unknown }).season_year)
      : NaN;
    const accessCode =
      typeof body === "object" && body !== null && "access_code" in body
        ? String((body as { access_code?: unknown }).access_code ?? "").trim()
        : "";
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
    const include_nxt = include_nxt_raw === true || include_nxt_raw === "true" || include_nxt_raw === 1;
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

    if (!isSiteAdmin) {
      if (isPublicCreate) {
        return NextResponse.json(
          { error: "Public leagues cannot be created. Join an open public league from Play Now instead." },
          { status: 403 }
        );
      }
      if (include_nxt) {
        return NextResponse.json(
          { error: "Only site administrators can set include_nxt." },
          { status: 403 }
        );
      }
      if (league_type_raw) {
        return NextResponse.json(
          { error: "Only site administrators can set league_type via this API." },
          { status: 403 }
        );
      }
      if (!(await leagueCreationAccessIsConfigured())) {
        return NextResponse.json(
          { error: "League creation access codes are not configured yet." },
          { status: 503 }
        );
      }
      const consume = await consumeLeagueCreationAccessCode(accessCode);
      if (!consume.ok) {
        return NextResponse.json(
          { error: consume.error ?? "Invalid league creation access code." },
          { status: 403 }
        );
      }
    }

    const ADMIN_TYPES = new Set(["season_overall", "head_to_head", "combo", "legacy", "salary_cap"]);
    const league_type = isPublicCreate
      ? SALARY_CAP_LEAGUE_TYPE
      : isSiteAdmin && league_type_raw
        ? ADMIN_TYPES.has(league_type_raw)
          ? league_type_raw
          : null
        : "season_overall";
    if (isSiteAdmin && league_type_raw && !league_type) {
      return NextResponse.json({ error: "Invalid league_type." }, { status: 400 });
    }
    if (isSiteAdmin && include_nxt && league_type !== "head_to_head" && league_type !== "salary_cap") {
      return NextResponse.json(
        { error: "include_nxt requires league_type head_to_head." },
        { status: 400 }
      );
    }
    const max_teams =
      isSiteAdmin && Number.isFinite(max_teams_raw)
        ? Math.min(16, Math.max(3, Math.floor(max_teams_raw)))
        : undefined;

    const { league, error } = await createLeague({
      name: isPublicCreate ? "Public League" : name,
      season_slug: isPublicCreate ? PUBLIC_SALARY_CAP_SEASON_SLUG : season_slug,
      season_year,
      league_type: isPublicCreate ? SALARY_CAP_LEAGUE_TYPE : isSiteAdmin ? league_type ?? "season_overall" : "season_overall",
      max_teams: isPublicCreate ? null : max_teams,
      include_nxt: isPublicCreate ? true : isSiteAdmin && include_nxt,
      visibility_type,
    });
    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }
    return NextResponse.json({ league });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
