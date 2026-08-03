import { NextRequest, NextResponse } from "next/server";
import { getSiteLeaderboards, normalizeSiteLeaderboardWeekStart } from "@/lib/siteLeaderboards";
import { getCurrentWeekStartMondayPst } from "@/lib/weeklyLeaderboards";
import { getAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  if (!getAdminClient()) {
    return NextResponse.json({ error: "Site leaderboards are not configured." }, { status: 503 });
  }
  const raw = request.nextUrl.searchParams.get("leaderboard_week");
  const currentMonday = getCurrentWeekStartMondayPst();
  const selected = normalizeSiteLeaderboardWeekStart(raw, currentMonday);
  const data = await getSiteLeaderboards({ leaderboardWeek: selected });
  if (!data.siteLeaderboardsAvailable) {
    return NextResponse.json({ error: "Site leaderboards are not configured." }, { status: 503 });
  }
  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "private, no-store",
    },
  });
}
