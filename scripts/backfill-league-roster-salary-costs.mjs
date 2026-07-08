#!/usr/bin/env node
/**
 * Backfill league_rosters.salary_cap_cost from league-frozen seed snapshots.
 *
 * Usage: node scripts/backfill-league-roster-salary-costs.mjs
 */
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const VALID = new Set([5, 10, 15, 20, 25]);
const NXT_COST = 5;

function isNxtBrand(brand) {
  if (!brand) return false;
  const l = String(brand).trim().toLowerCase();
  return l === "nxt" || l.includes("nxt");
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const admin = createClient(url, key);

  const { data: leagues, error: lErr } = await admin
    .from("leagues")
    .select("id, slug")
    .eq("league_type", "salary_cap");
  if (lErr) {
    console.error(lErr.message);
    process.exit(1);
  }

  let updated = 0;
  let skipped = 0;

  for (const league of leagues ?? []) {
    const { data: snapRows, error: sErr } = await admin
      .from("league_wrestler_salary_snapshots")
      .select("wrestler_id, salary_cap_cost")
      .eq("league_id", league.id);
    if (sErr) {
      console.error(league.slug, sErr.message);
      continue;
    }
    const frozenByWrestlerId = Object.fromEntries(
      (snapRows ?? [])
        .filter((r) => VALID.has(r.salary_cap_cost))
        .map((r) => [r.wrestler_id, r.salary_cap_cost])
    );

    const { data: rosterRows, error: rErr } = await admin
      .from("league_rosters")
      .select("id, wrestler_id, salary_cap_cost")
      .eq("league_id", league.id)
      .is("released_at", null);
    if (rErr) {
      if (/salary_cap_cost/i.test(rErr.message)) {
        console.error("Run supabase/league_rosters_salary_cap_cost.sql first");
        process.exit(1);
      }
      console.error(league.slug, rErr.message);
      continue;
    }

    for (const row of rosterRows ?? []) {
      if (row.salary_cap_cost != null && VALID.has(row.salary_cap_cost)) {
        skipped++;
        continue;
      }

      let cost = frozenByWrestlerId[row.wrestler_id];
      if (cost == null) {
        const { data: w } = await admin
          .from("wrestlers")
          .select("brand")
          .eq("id", row.wrestler_id)
          .maybeSingle();
        if (isNxtBrand(w?.brand)) cost = NXT_COST;
      }
      if (cost == null || !VALID.has(cost)) {
        console.warn(`no frozen cost for ${league.slug} wrestler ${row.wrestler_id}`);
        continue;
      }

      const { error } = await admin.from("league_rosters").update({ salary_cap_cost: cost }).eq("id", row.id);
      if (error) {
        console.error(league.slug, row.id, error.message);
        continue;
      }
      updated++;
    }
  }

  console.log(`done: ${updated} roster rows updated, ${skipped} already locked`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
