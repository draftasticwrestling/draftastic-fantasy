import { NextResponse } from "next/server";
import { getHoldingsByOwner, getHoldingsForOwner } from "@/lib/discoveryHoldings";
import { EXAMPLE_LEAGUE } from "@/lib/league";

const LEAGUE_SLUG = EXAMPLE_LEAGUE.slug;

/**
 * GET /api/league/discovery-holdings?owner=christopher-cramer
 * Returns discovery holdings for that owner. Omit owner for all owners.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const owner = searchParams.get("owner");

    if (owner) {
      const holdings = await getHoldingsForOwner(LEAGUE_SLUG, owner);
      return NextResponse.json({ league_slug: LEAGUE_SLUG, owner, holdings });
    }

    const byOwner = await getHoldingsByOwner(LEAGUE_SLUG);
    return NextResponse.json({ league_slug: LEAGUE_SLUG, by_owner: byOwner });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
