import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { processTradeTimerDeadlines } from "@/lib/leagueOwner";

/**
 * GET /api/cron/process-trades
 *
 * - Expire pending trade offers after 48h (no recipient response).
 * - Auto-execute accepted trades after 48h if GM hasn't acted.
 *
 * Secured by x-cron-secret header; set CRON_SECRET in env and pass it in the request.
 */
export async function GET(request: Request) {
  const secret = request.headers.get("x-cron-secret");
  const expected = process.env.CRON_SECRET;
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!getAdminClient()) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY not set" }, { status: 500 });
  }

  const { expired, autoExecuted, expireErrors, execErrors } =
    await processTradeTimerDeadlines();

  return NextResponse.json({
    expired,
    autoExecuted,
    expireErrors: expireErrors.length ? expireErrors : undefined,
    execErrors: execErrors.length ? execErrors : undefined,
  });
}

