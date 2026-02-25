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
  }));
  return NextResponse.json({ leagues: payload });
}
