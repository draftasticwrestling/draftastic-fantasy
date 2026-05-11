import { NextRequest, NextResponse } from "next/server";
import { getHubSiteLeaderboards } from "@/lib/hubSiteLeaderboards";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("leaderboard_week");
  const data = await getHubSiteLeaderboards({ leaderboardWeek: raw });
  if (!data.hubLeaderboardsAvailable) {
    return NextResponse.json({ error: "Hub leaderboards are not configured." }, { status: 503 });
  }
  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "private, no-store",
    },
  });
}
