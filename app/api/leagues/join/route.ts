import { NextResponse } from "next/server";
import { joinLeagueWithToken } from "@/lib/leagues";

/**
 * POST /api/leagues/join — join a league with an invite token. Body: { token }.
 * Returns { ok, league_slug } on success so client can redirect.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const token = typeof body.token === "string" ? body.token.trim() : "";
    if (!token) {
      return NextResponse.json({ error: "token required" }, { status: 400 });
    }

    const result = await joinLeagueWithToken(token);
    if (!result.ok) {
      return NextResponse.json({ error: result.error ?? "Join failed" }, { status: 400 });
    }
    return NextResponse.json({
      ok: true,
      league_slug: result.league_slug,
      message: result.message,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
