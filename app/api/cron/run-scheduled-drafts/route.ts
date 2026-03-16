import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import {
  runFullAutopickDraftAtScheduledTime,
  getScheduledDraftTimeMs,
  generateDraftOrderForScheduledDraft,
} from "@/lib/leagueDraft";

const FIFTY_MIN_MS = 50 * 60 * 1000;
const SEVENTY_MIN_MS = 70 * 60 * 1000;

/**
 * GET /api/cron/run-scheduled-drafts
 *
 * 1. "Randomize draft order one hour before": For autopick leagues with draft_order_method
 *    random_one_hour_before (or default), if draft time is in ~50–70 minutes, ensure draft order
 *    exists (generate with service role so all teams get correct slots).
 * 2. Run autopick: When draft time has passed and order exists, run the full draft to completion.
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

  const now = Date.now();

  const { data: leagues } = await admin
    .from("leagues")
    .select("id, draft_date, draft_time, draft_type, draft_status, draft_order_method")
    .eq("draft_type", "autopick")
    .eq("draft_status", "not_started");

  if (!leagues?.length) {
    return NextResponse.json({ ran: 0, orderGenerated: 0, message: "No autopick drafts" });
  }

  let orderGenerated = 0;
  const orderErrors: string[] = [];

  for (const league of leagues) {
    const scheduledMs = getScheduledDraftTimeMs(league);
    if (scheduledMs == null) continue;

    const msUntilDraft = scheduledMs - now;

    if (msUntilDraft >= FIFTY_MIN_MS && msUntilDraft <= SEVENTY_MIN_MS) {
      const method = (league as { draft_order_method?: string }).draft_order_method;
      if (method === "manual_by_gm") continue;
      const { count } = await admin
        .from("league_draft_order")
        .select("*", { count: "exact", head: true })
        .eq("league_id", league.id);
      if (count && count > 0) continue;
      const res = await generateDraftOrderForScheduledDraft(league.id);
      if (res.error) orderErrors.push(`${league.id}: ${res.error}`);
      else orderGenerated += 1;
    }
  }

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
    orderGenerated,
    errors: errors.length ? errors : undefined,
    orderErrors: orderErrors.length ? orderErrors : undefined,
  });
}
