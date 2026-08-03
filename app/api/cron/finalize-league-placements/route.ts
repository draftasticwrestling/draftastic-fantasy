import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getAdminClient } from "@/lib/supabase/admin";
import { finalizeDueLeagueChampions } from "@/lib/leagueSeasonPlacements";

/**
 * GET /api/cron/finalize-league-placements
 *
 * After a league's end_date passes end-of-day Pacific, record the champion in
 * `league_season_placements` (and award placement XP once). Idempotent; H2H leagues
 * stay pending until the playoff final is decided, then succeed on a later run.
 *
 * Secured by x-cron-secret. Optional: `dryRun=1`, `limit=N`, `force=1`.
 */
export async function GET(request: Request) {
  const secret = request.headers.get("x-cron-secret");
  const expected = process.env.CRON_SECRET;
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Admin client unavailable" }, { status: 503 });
  }

  const url = new URL(request.url);
  const dryRun = url.searchParams.get("dryRun") === "1" || url.searchParams.get("dryRun") === "true";
  const force = url.searchParams.get("force") === "1" || url.searchParams.get("force") === "true";
  const limitRaw = url.searchParams.get("limit");
  const limitParsed = limitRaw ? Number.parseInt(limitRaw, 10) : NaN;
  const limit = Number.isFinite(limitParsed) && limitParsed > 0 ? limitParsed : undefined;

  const result = await finalizeDueLeagueChampions(admin, { dryRun, force, limit });
  if (!dryRun && result.recorded > 0) {
    revalidatePath("/");
    revalidatePath("/account");
  }

  const status = result.error > 0 ? 207 : 200;
  return NextResponse.json({ ok: true, dryRun, ...result }, { status });
}
