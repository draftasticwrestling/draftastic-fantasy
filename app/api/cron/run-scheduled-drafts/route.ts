import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import {
  runFullAutopickDraftAtScheduledTime,
  getScheduledDraftTimeMs,
} from "@/lib/leagueDraft";

/**
 * GET /api/cron/run-scheduled-drafts
 *
 * Intended to be called by Netlify Scheduled Functions (or another cron) so that
 * autopick drafts run at their scheduled time without requiring a user to visit the page.
 *
 * Secured by x-cron-secret header; set CRON_SECRET in Netlify env and pass it in the request.
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

  const { data: leagues } = await admin
    .from("leagues")
    .select("id, draft_date, draft_time, draft_type, draft_status")
    .eq("draft_type", "autopick")
    .eq("draft_status", "not_started");

  if (!leagues?.length) {
    return NextResponse.json({ ran: 0, message: "No due autopick drafts" });
  }

  const now = Date.now();
  const due: { id: string }[] = [];
  for (const league of leagues) {
    const scheduledMs = getScheduledDraftTimeMs(league);
    if (scheduledMs == null || now < scheduledMs) continue;
    const { count } = await admin
      .from("league_draft_order")
      .select("*", { count: "exact", head: true })
      .eq("league_id", league.id);
    if (count && count > 0) due.push({ id: league.id });
  }

  let ran = 0;
  const errors: string[] = [];
  for (const { id } of due) {
    const result = await runFullAutopickDraftAtScheduledTime(id);
    if (result.didRun) ran += 1;
    if (result.error) errors.push(`${id}: ${result.error}`);
  }

  return NextResponse.json({
    ran,
    due: due.length,
    errors: errors.length ? errors : undefined,
  });
}
