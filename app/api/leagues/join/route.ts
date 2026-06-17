import { NextResponse } from "next/server";
import {
  getLeagueBySlug,
  joinLeagueWithCode,
  joinLeagueWithToken,
  quickJoinOldestPublicLeague,
} from "@/lib/leagues";
import { leaguePostJoinPath } from "@/lib/leagueOnboarding";

/**
 * POST /api/leagues/join — join with invite token, permanent league code, or public quick join.
 * Body: { token } | { code } | { public_quick_join: true }.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const token = typeof body.token === "string" ? body.token.trim() : "";
    const code = typeof body.code === "string" ? body.code.trim() : "";
    const publicQuickJoin = body.public_quick_join === true;

    if (publicQuickJoin) {
      const result = await quickJoinOldestPublicLeague();
      if (!result.ok) {
        return NextResponse.json({ error: result.error ?? "Join failed" }, { status: 400 });
      }
      const league = result.league_slug ? await getLeagueBySlug(result.league_slug) : null;
      const redirect_to = result.league_slug
        ? leaguePostJoinPath(result.league_slug, {
            league_type: league?.league_type ?? null,
            season_slug: league?.season_slug ?? null,
          })
        : "/leagues";
      return NextResponse.json({
        ok: true,
        league_slug: result.league_slug,
        redirect_to,
        message: result.message,
      });
    }

    if (!token && !code) {
      return NextResponse.json({ error: "token or code required" }, { status: 400 });
    }
    if (token && code) {
      return NextResponse.json({ error: "Send only one join method per request" }, { status: 400 });
    }

    const result = code ? await joinLeagueWithCode(code) : await joinLeagueWithToken(token);
    if (!result.ok) {
      const err = result.error ?? "Join failed";
      const isFull = /league is full/i.test(err);
      return NextResponse.json({ error: err }, { status: isFull ? 409 : 400 });
    }
    const league = result.league_slug ? await getLeagueBySlug(result.league_slug) : null;
    const redirect_to = result.league_slug
      ? leaguePostJoinPath(result.league_slug, {
          league_type: league?.league_type ?? null,
          season_slug: league?.season_slug ?? null,
        })
      : "/leagues";

    return NextResponse.json({
      ok: true,
      league_slug: result.league_slug,
      redirect_to,
      message: result.message,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
