import { NextResponse } from "next/server";
import { createLeagueInvite } from "@/lib/leagues";

/**
 * POST /api/leagues/invite — create an invite link. Body: { league_id }. Returns { url, token }.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const league_id = typeof body.league_id === "string" ? body.league_id.trim() : "";
    if (!league_id) {
      return NextResponse.json({ error: "league_id required" }, { status: 400 });
    }

    const { url, token, error } = await createLeagueInvite(league_id);
    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }
    return NextResponse.json({ url, token });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
