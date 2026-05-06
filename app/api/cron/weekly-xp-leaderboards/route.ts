import { NextResponse } from "next/server";
import { processWeeklyXpAndLeaderboards } from "@/lib/weeklyLeaderboards";

/**
 * GET /api/cron/weekly-xp-leaderboards
 *
 * Weekly snapshot + XP awards:
 * - Stores weekly per-user points in `league_weekly_points_snapshot`
 * - Awards weekly high score XP (ties award all top scorers)
 * - Refreshes fantasy-points-per-50 XP tiers for impacted users
 *
 * Secured by x-cron-secret header.
 * Optional: `weekStart` (Monday YYYY-MM-DD), `reprocess=1` to ignore “snapshot already complete” skip.
 */
export async function GET(request: Request) {
  const secret = request.headers.get("x-cron-secret");
  const expected = process.env.CRON_SECRET;
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const weekStart = url.searchParams.get("weekStart") || undefined;
  const reprocess =
    url.searchParams.get("reprocess") === "1" || url.searchParams.get("reprocess") === "true";
  const result = await processWeeklyXpAndLeaderboards(weekStart, { reprocess });
  const status = result.errors.length > 0 ? 207 : 200;
  return NextResponse.json(result, { status });
}
