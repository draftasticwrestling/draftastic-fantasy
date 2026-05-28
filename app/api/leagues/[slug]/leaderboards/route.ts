import { NextRequest, NextResponse } from "next/server";
import { getLeagueBySlug, getLeagueMembers } from "@/lib/leagues";
import { getPointsByOwnerForLeagueWithBonuses } from "@/lib/leagueMatchups";
import { getLeagueHomeLeaderboards } from "@/lib/weeklyLeaderboards";
import { getAdminClient } from "@/lib/supabase/admin";

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  if (!getAdminClient()) {
    return NextResponse.json({ error: "Leaderboards are not configured." }, { status: 503 });
  }

  const { slug } = await context.params;
  const league = await getLeagueBySlug(slug);
  if (!league) {
    return NextResponse.json({ error: "League not found or access denied." }, { status: 404 });
  }

  const members = await getLeagueMembers(league.id);
  const pointsByUserId = await getPointsByOwnerForLeagueWithBonuses(league.id);
  const raw = request.nextUrl.searchParams.get("leaderboard_week");

  const data = await getLeagueHomeLeaderboards({
    leagueId: league.id,
    members,
    pointsByUserId,
    leagueStartYmd: (league.draft_date || league.start_date) ?? null,
    leagueEndYmd: league.end_date ?? null,
    leaderboardWeek: raw,
  });

  if (!data.leagueLeaderboardsAvailable) {
    return NextResponse.json({ error: "Leaderboards are not configured." }, { status: 503 });
  }

  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "private, no-store",
    },
  });
}
