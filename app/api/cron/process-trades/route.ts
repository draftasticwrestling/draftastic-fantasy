import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { executeTradeWithServiceRole } from "@/lib/leagueOwner";

const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;

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

  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY not set" }, { status: 500 });
  }

  const nowMs = Date.now();
  const cutoffIso = new Date(nowMs - FORTY_EIGHT_HOURS_MS).toISOString();

  // 1) Expire pending offers older than 48h.
  const { data: pendingOld } = await admin
    .from("league_trade_proposals")
    .select("id")
    .eq("status", "pending")
    .lt("created_at", cutoffIso);

  let expired = 0;
  const expireErrors: string[] = [];
  for (const row of pendingOld ?? []) {
    const id = (row as { id: string }).id;
    const { error } = await admin
      .from("league_trade_proposals")
      .update({ status: "expired", expired_at: new Date().toISOString() })
      .eq("id", id)
      .eq("status", "pending");
    if (error) expireErrors.push(`${id}: ${error.message}`);
    else expired += 1;
  }

  // 2) Auto-execute accepted trades where GM hasn't acted within 48h.
  const { data: awaitingOld } = await admin
    .from("league_trade_proposals")
    .select("id, accepted_at, executed_at")
    .eq("status", "awaiting_gm_approval")
    .lt("accepted_at", cutoffIso);

  let autoExecuted = 0;
  const execErrors: string[] = [];
  const sortedAwaiting = [...(awaitingOld ?? [])].sort((a, b) =>
    String((a as { accepted_at?: string | null }).accepted_at ?? "").localeCompare(
      String((b as { accepted_at?: string | null }).accepted_at ?? "")
    )
  );
  for (const row of sortedAwaiting) {
    const r = row as { id: string; accepted_at: string | null; executed_at: string | null };
    if (r.executed_at) continue;

    // First, atomically claim this trade by marking gm_approved (auto) if it's still awaiting GM.
    const nowIso = new Date().toISOString();
    const { error: claimErr } = await admin
      .from("league_trade_proposals")
      .update({ status: "gm_approved", gm_responded_at: nowIso, responded_at: nowIso })
      .eq("id", r.id)
      .eq("status", "awaiting_gm_approval");
    if (claimErr) {
      execErrors.push(`${r.id}: ${claimErr.message}`);
      continue;
    }

    const exec = await executeTradeWithServiceRole(r.id);
    if (exec.error) {
      execErrors.push(`${r.id}: ${exec.error}`);
      continue;
    }
    autoExecuted += 1;
  }

  return NextResponse.json({
    expired,
    autoExecuted,
    expireErrors: expireErrors.length ? expireErrors : undefined,
    execErrors: execErrors.length ? execErrors : undefined,
  });
}

