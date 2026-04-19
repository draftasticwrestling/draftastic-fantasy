import { NextResponse } from "next/server";
import { joinLeagueWithCode, joinLeagueWithToken, quickJoinOldestPublicLeague } from "@/lib/leagues";

/**
 * POST /api/leagues/join — join with invite token or permanent league code.
 * Body: { token } or { code } or { public_quick_join: true }.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const token = typeof body.token === "string" ? body.token.trim() : "";
    const code = typeof body.code === "string" ? body.code.trim() : "";
    const publicQuickJoin = body.public_quick_join === true;

    if (!token && !code && !publicQuickJoin) {
      return NextResponse.json({ error: "token, code, or public_quick_join required" }, { status: 400 });
    }
    if ((token ? 1 : 0) + (code ? 1 : 0) + (publicQuickJoin ? 1 : 0) > 1) {
      return NextResponse.json({ error: "Send only one join method per request" }, { status: 400 });
    }

    const result = publicQuickJoin
      ? await quickJoinOldestPublicLeague()
      : code
        ? await joinLeagueWithCode(code)
        : await joinLeagueWithToken(token);
    if (!result.ok) {
      const err = result.error ?? "Join failed";
      const isFull = /league is full/i.test(err);
      return NextResponse.json({ error: err }, { status: isFull ? 409 : 400 });
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
