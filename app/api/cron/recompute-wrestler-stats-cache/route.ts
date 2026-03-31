import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { recomputeWrestlerStatsCache } from "@/lib/recomputeWrestlerStatsCache";

/**
 * GET /api/cron/recompute-wrestler-stats-cache
 * Recomputes pre-aggregated wrestler stats used by high-traffic wrestler tables.
 * Secured by x-cron-secret header; set CRON_SECRET and pass it in the request.
 */
export async function GET(request: Request) {
  const secret = request.headers.get("x-cron-secret");
  const expected = process.env.CRON_SECRET;
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY not set" },
      { status: 500 }
    );
  }

  try {
    const summary = await recomputeWrestlerStatsCache(admin);
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Recompute failed", details: message }, { status: 500 });
  }
}

