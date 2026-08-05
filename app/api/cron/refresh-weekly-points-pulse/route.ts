import { NextResponse } from "next/server";
import { refreshCurrentWeekPointsSnapshotsForPulse } from "@/lib/weeklyLeaderboards";

/**
 * GET /api/cron/refresh-weekly-points-pulse
 *
 * Refreshes `league_weekly_points_snapshot` for the **current** Pacific fantasy week
 * so the hub FOMO “pts this week” total stays accurate mid-week. Does not award XP.
 *
 * Secured by x-cron-secret header.
 */
export async function GET(request: Request) {
  const secret = request.headers.get("x-cron-secret");
  const expected = process.env.CRON_SECRET;
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await refreshCurrentWeekPointsSnapshotsForPulse();
  const status = result.errors.length > 0 ? 207 : 200;
  return NextResponse.json({ ok: result.errors.length === 0, ...result }, { status });
}
