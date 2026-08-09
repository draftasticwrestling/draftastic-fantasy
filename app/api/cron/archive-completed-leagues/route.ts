import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getAdminClient } from "@/lib/supabase/admin";
import { runLeagueLifecycleMaintenance } from "@/lib/leagueArchive";

/**
 * GET /api/cron/archive-completed-leagues
 *
 * 1) Archives finished leagues two weeks after end_date (once a champion placement exists).
 * 2) Marks underfilled private leagues inactive after 2 weeks from creation; archives them after 4 weeks.
 *
 * Secured by x-cron-secret. Optional: `dryRun=1`, `limit=N`.
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
  const limitRaw = url.searchParams.get("limit");
  const limitParsed = limitRaw ? Number.parseInt(limitRaw, 10) : NaN;
  const limit = Number.isFinite(limitParsed) && limitParsed > 0 ? limitParsed : undefined;

  const result = await runLeagueLifecycleMaintenance(admin, { dryRun, limit });
  const changed =
    result.completed.archived +
      result.privateLife.archived +
      result.privateLife.markedInactive +
      result.privateLife.reactivated >
    0;
  if (!dryRun && changed) {
    revalidatePath("/leagues");
    revalidatePath("/fantasy");
    revalidatePath("/internal-admin/leagues");
  }

  const status = result.completed.error + result.privateLife.error > 0 ? 207 : 200;
  return NextResponse.json({ ok: true, dryRun, ...result }, { status });
}
