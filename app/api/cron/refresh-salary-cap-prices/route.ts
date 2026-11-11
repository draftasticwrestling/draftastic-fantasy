import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { getCivilYmdInPst } from "@/lib/pstCivilTime";
import { refreshSalaryCapPrices } from "@/lib/refreshSalaryCapPrices";

/**
 * GET /api/cron/refresh-salary-cap-prices
 * Rewrites global wrestler salary-cap prices. Runs on the 1st (Pacific) unless `x-cron-force: 1`.
 * Does not change prices already locked to an existing league.
 */
export async function GET(request: Request) {
  const secret = request.headers.get("x-cron-secret");
  const expected = process.env.CRON_SECRET;
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const asOfYmd = getCivilYmdInPst(Date.now());
  const force = request.headers.get("x-cron-force") === "1";
  if (!force && !asOfYmd.endsWith("-01")) {
    return NextResponse.json({ ok: true, skipped: true, reason: "not the 1st in Pacific time", asOfYmd });
  }

  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY not set" }, { status: 500 });
  }

  try {
    const summary = await refreshSalaryCapPrices(admin, asOfYmd);
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Salary cap refresh failed", details: message }, { status: 500 });
  }
}
