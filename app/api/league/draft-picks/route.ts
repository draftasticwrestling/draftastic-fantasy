import { NextResponse } from "next/server";
import { getDraftPicksByOwner, getDraftPicksForOwner, DEFAULT_SEASON } from "@/lib/draftPicks";
import { EXAMPLE_LEAGUE } from "@/lib/league";

const LEAGUE_SLUG = EXAMPLE_LEAGUE.slug;

/**
 * GET /api/league/draft-picks?season=3
 * Returns draft picks for the league, grouped by current owner.
 *
 * GET /api/league/draft-picks?season=3&owner=christopher-cramer
 * Returns only picks currently held by that owner.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const season = parseInt(searchParams.get("season") ?? String(DEFAULT_SEASON), 10) || DEFAULT_SEASON;
    const owner = searchParams.get("owner");

    if (owner) {
      const picks = await getDraftPicksForOwner(LEAGUE_SLUG, season, owner);
      return NextResponse.json({ league_slug: LEAGUE_SLUG, season, owner, picks });
    }

    const byOwner = await getDraftPicksByOwner(LEAGUE_SLUG, season);
    return NextResponse.json({ league_slug: LEAGUE_SLUG, season, by_owner: byOwner });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
