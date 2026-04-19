import { NextResponse } from "next/server";
import { getLeaguesForUser } from "@/lib/leagues";

/**
 * GET /api/me/leagues
 * Returns leagues the current user is a member of (slug, name, role).
 * Used by the nav for league switcher and to decide whether to show the lower bar.
 */
export async function GET() {
  const leagues = await getLeaguesForUser();
  const payload = leagues.map((l) => ({
    slug: l.slug,
    name: l.name,
    role: l.role,
    league_type: (l as { league_type?: string | null }).league_type ?? null,
    season_slug: (l as { season_slug?: string | null }).season_slug ?? null,
    visibility_type: (l as { visibility_type?: string | null }).visibility_type ?? "private",
  }));
  return NextResponse.json({ leagues: payload });
}
