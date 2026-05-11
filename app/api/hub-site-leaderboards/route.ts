import { NextRequest, NextResponse } from "next/server";
import { getHubSiteLeaderboards, normalizeHubLeaderboardWeekStart } from "@/lib/hubSiteLeaderboards";
import { getCurrentWeekStartMondayPst } from "@/lib/weeklyLeaderboards";
import { getAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  if (!getAdminClient()) {
    return NextResponse.json({ error: "Hub leaderboards are not configured." }, { status: 503 });
  }
  const raw = request.nextUrl.searchParams.get("leaderboard_week");
  const currentMonday = getCurrentWeekStartMondayPst();
  const selected = normalizeHubLeaderboardWeekStart(raw, currentMonday);
  const data = await getHubSiteLeaderboards({ leaderboardWeek: selected });
  if (!data.hubLeaderboardsAvailable) {
    return NextResponse.json({ error: "Hub leaderboards are not configured." }, { status: 503 });
  }
  return NextResponse.json(data, {
    headers: {
      // Week is driven by `leaderboard_week`; avoid any intermediary/browser mixing responses across weeks.
      "Cache-Control": "private, no-store",
    },
  });
}
