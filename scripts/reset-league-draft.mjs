#!/usr/bin/env node
/**
 * One-off: clear draft picks and rosters for a league so the draft can be started over.
 * Usage: node scripts/reset-league-draft.mjs <league-slug>
 * Example: node scripts/reset-league-draft.mjs draftastic-test-2
 * Requires .env with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const slug = process.argv[2];
if (!slug) {
  console.error("Usage: node scripts/reset-league-draft.mjs <league-slug>");
  process.exit(1);
}

// Load .env from project root
const envPath = resolve(process.cwd(), ".env");
if (existsSync(envPath)) {
  const content = readFileSync(envPath, "utf8");
  content.split("\n").forEach((line) => {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
  });
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(url, key);

async function main() {
  const { data: league, error: leagueErr } = await supabase
    .from("leagues")
    .select("id, name")
    .eq("slug", slug)
    .maybeSingle();

  if (leagueErr) {
    console.error("League lookup failed:", leagueErr.message);
    process.exit(1);
  }
  if (!league) {
    console.error("No league found with slug:", slug);
    process.exit(1);
  }

  const leagueId = league.id;
  console.log("League:", league.name, "(" + slug + ")");
  console.log("Clearing draft picks, rosters, and draft order...");

  const { error: picksErr } = await supabase.from("league_draft_picks").delete().eq("league_id", leagueId);
  if (picksErr) {
    console.error("Failed to delete draft picks:", picksErr.message);
    process.exit(1);
  }
  console.log("  Deleted league_draft_picks");

  const { error: rostersErr } = await supabase.from("league_rosters").delete().eq("league_id", leagueId);
  if (rostersErr) {
    console.error("Failed to delete rosters:", rostersErr.message);
    process.exit(1);
  }
  console.log("  Deleted league_rosters");

  const { error: orderErr } = await supabase.from("league_draft_order").delete().eq("league_id", leagueId);
  if (orderErr) {
    console.error("Failed to delete draft order:", orderErr.message);
    process.exit(1);
  }
  console.log("  Deleted league_draft_order");

  const { error: updateErr } = await supabase
    .from("leagues")
    .update({
      draft_status: "not_started",
      draft_current_pick: null,
      draft_current_pick_started_at: null,
    })
    .eq("id", leagueId);

  if (updateErr) {
    console.error("Failed to reset league draft state:", updateErr.message);
    process.exit(1);
  }
  console.log("  Reset league draft state to not_started");

  console.log("Done. You can open the draft page and generate a new draft order.");
}

main();
