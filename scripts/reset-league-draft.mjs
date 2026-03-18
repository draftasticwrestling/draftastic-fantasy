#!/usr/bin/env node
/**
 * One-off: clear draft picks, rosters, and order for a league so the draft can be started over.
 * Usage: node scripts/reset-league-draft.mjs <league-slug> [draft_date] [draft_time] [draft_type]
 * Example: node scripts/reset-league-draft.mjs season-points-test
 * Example: node scripts/reset-league-draft.mjs season-points-test "" "" offline
 * Requires .env with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const slug = process.argv[2];
const draftDateArg = process.argv[3]; // YYYY-MM-DD or "" to skip
const draftTimeArg = process.argv[4]; // HH:MM or "" to skip
const draftTypeArg = process.argv[5]; // offline | live | autopick

if (!slug) {
  console.error("Usage: node scripts/reset-league-draft.mjs <league-slug> [draft_date] [draft_time] [draft_type]");
  process.exit(1);
}

// Load .env and .env.local from project root (Next.js often uses .env.local for secrets)
function loadEnvFile(filename) {
  const envPath = resolve(process.cwd(), filename);
  if (existsSync(envPath)) {
    const content = readFileSync(envPath, "utf8");
    content.split("\n").forEach((line) => {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m) {
        const k = m[1].trim();
        const v = m[2].trim().replace(/^["']|["']$/g, "");
        if (v) process.env[k] = v;
      }
    });
  }
}
loadEnvFile(".env");
loadEnvFile(".env.local");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
// Accept exact name or common alternate
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY;
if (!url || !key) {
  const cwd = process.cwd();
  console.error("Missing env vars. Check .env / .env.local in:", cwd);
  console.error("  NEXT_PUBLIC_SUPABASE_URL:", url ? "set" : "missing");
  console.error("  SUPABASE_SERVICE_ROLE_KEY:", key ? "set" : "missing");
  console.error("  Use exactly: SUPABASE_SERVICE_ROLE_KEY=your_key (no space around =, value = long JWT from Supabase API settings)");
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

  const updatePayload = {
    draft_status: "not_started",
    draft_current_pick: null,
    draft_current_pick_started_at: null,
  };
  if (draftDateArg && /^\d{4}-\d{2}-\d{2}$/.test(draftDateArg)) {
    updatePayload.draft_date = draftDateArg;
    if (draftTimeArg && /^\d{1,2}:\d{2}(:\d{2})?$/.test(draftTimeArg)) {
      updatePayload.draft_time = draftTimeArg.length === 5 ? draftTimeArg : draftTimeArg.slice(0, 5);
    }
  }
  if (draftTypeArg && ["offline", "live", "autopick"].includes(draftTypeArg)) {
    updatePayload.draft_type = draftTypeArg;
  }

  const { error: updateErr } = await supabase
    .from("leagues")
    .update(updatePayload)
    .eq("id", leagueId);

  if (updateErr) {
    console.error("Failed to reset league draft state:", updateErr.message);
    process.exit(1);
  }
  console.log("  Reset league draft state to not_started");
  if (updatePayload.draft_date) {
    console.log("  Set draft_date:", updatePayload.draft_date, updatePayload.draft_time ? "draft_time: " + updatePayload.draft_time : "");
  }
  if (updatePayload.draft_type) {
    console.log("  Set draft_type:", updatePayload.draft_type);
  }

  console.log("Done. For offline draft, enter rosters manually on the league/draft page or via League Settings.");
}

main();
