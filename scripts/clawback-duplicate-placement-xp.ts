/**
 * Remove duplicate league placement XP caused by seasonKey drift in idempotency keys.
 * Keeps the earliest grant per (leagueId, userId, 1st|2nd); deletes later duplicates
 * and subtracts their deltas from user_xp_state.total_xp.
 *
 * Usage:
 *   npx tsx scripts/clawback-duplicate-placement-xp.ts --dry-run
 *   npx tsx scripts/clawback-duplicate-placement-xp.ts
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

type LedgerRow = {
  id: string;
  user_id: string;
  delta: number;
  reason: string;
  idempotency_key: string;
  created_at: string;
};

function parseKey(key: string): {
  leagueId: string;
  seasonKey: string;
  userId: string;
  place: "1st" | "2nd";
  teamCount: string;
} | null {
  const m = /^league_place:([0-9a-f-]{36}):(.+):([0-9a-f-]{36}):(1st|2nd):(\d+)$/.exec(key);
  if (!m) return null;
  return {
    leagueId: m[1]!,
    seasonKey: m[2]!,
    userId: m[3]!,
    place: m[4] as "1st" | "2nd",
    teamCount: m[5]!,
  };
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing SUPABASE env");
    process.exit(1);
  }
  const admin = createClient(url, key, { auth: { persistSession: false } });

  const pageSize = 1000;
  let from = 0;
  const rows: LedgerRow[] = [];
  for (;;) {
    const { data, error } = await admin
      .from("user_xp_ledger")
      .select("id, user_id, delta, reason, idempotency_key, created_at")
      .or("reason.like.league_win_%,reason.like.league_second_%")
      .order("created_at", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    rows.push(...(data as LedgerRow[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }

  const byGroup = new Map<string, LedgerRow[]>();
  for (const r of rows) {
    const p = parseKey(r.idempotency_key);
    if (!p) {
      console.warn("skip unparsed key", r.idempotency_key);
      continue;
    }
    const g = `${p.leagueId}|${p.userId}|${p.place}`;
    if (!byGroup.has(g)) byGroup.set(g, []);
    byGroup.get(g)!.push(r);
  }

  const clawIds: string[] = [];
  const clawByUser = new Map<string, number>();
  for (const [g, list] of byGroup) {
    if (list.length < 2) continue;
    const keep = list[0]!;
    const claw = list.slice(1);
    console.log(`\n${g}`);
    console.log(`  KEEP ${keep.created_at} +${keep.delta} ${keep.idempotency_key}`);
    for (const c of claw) {
      console.log(`  CLAW ${c.created_at} +${c.delta} ${c.id} ${c.idempotency_key}`);
      clawIds.push(c.id);
      clawByUser.set(c.user_id, (clawByUser.get(c.user_id) ?? 0) + Number(c.delta));
    }
  }

  if (clawIds.length === 0) {
    console.log("No duplicate placement XP found.");
    return;
  }

  console.log(`\nWould remove ${clawIds.length} ledger row(s) for ${clawByUser.size} user(s). dryRun=${dryRun}`);
  for (const [uid, amt] of clawByUser) {
    console.log(`  user=${uid} subtract=${amt}`);
  }

  if (dryRun) return;

  for (const [uid, amt] of clawByUser) {
    const { data: state, error: stateErr } = await admin
      .from("user_xp_state")
      .select("total_xp")
      .eq("user_id", uid)
      .maybeSingle();
    if (stateErr) throw new Error(stateErr.message);
    const prev = Number((state as { total_xp?: number } | null)?.total_xp ?? 0);
    const next = Math.max(0, prev - amt);
    const { error: upErr } = await admin
      .from("user_xp_state")
      .update({ total_xp: next, updated_at: new Date().toISOString() })
      .eq("user_id", uid);
    if (upErr) throw new Error(upErr.message);
    console.log(`updated total_xp user=${uid} ${prev} -> ${next}`);
  }

  const { error: delErr } = await admin.from("user_xp_ledger").delete().in("id", clawIds);
  if (delErr) throw new Error(delErr.message);
  console.log(`Deleted ${clawIds.length} duplicate ledger row(s).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
