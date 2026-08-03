/**
 * Finalize Road to SummerSlam 2026 league champions into league_season_placements
 * and award placement XP (idempotent).
 *
 * Prerequisites:
 *   - Run supabase/league_season_placements.sql
 *   - Season past end-of-day PST on 2026-08-02
 *   - SummerSlam scoring finalized (H2H finals decided where applicable)
 *
 * Usage:
 *   npx tsx scripts/finalize-league-season-placements.ts
 *   npx tsx scripts/finalize-league-season-placements.ts --dry-run
 *   npx tsx scripts/finalize-league-season-placements.ts --force
 *   npx tsx scripts/finalize-league-season-placements.ts --league-id=<uuid>[,uuid...]
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { finalizeAllRtss2026Champions } from "../lib/leagueSeasonPlacements";

function printHelp(): void {
  console.log(`finalize-league-season-placements — record RTSS 2026 champions.

  npx tsx scripts/finalize-league-season-placements.ts
  npx tsx scripts/finalize-league-season-placements.ts --dry-run
  npx tsx scripts/finalize-league-season-placements.ts --force
  npx tsx scripts/finalize-league-season-placements.ts --league-id=<uuid>[,uuid...]

  Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.`);
}

function parseArgs(argv: string[]): {
  dryRun: boolean;
  force: boolean;
  leagueIds: Set<string> | null;
} {
  let dryRun = false;
  let force = false;
  let leagueIds: Set<string> | null = null;
  for (const a of argv) {
    if (a === "--help" || a === "-h") {
      printHelp();
      process.exit(0);
    }
    if (a === "--dry-run") dryRun = true;
    else if (a === "--force") force = true;
    else if (a.startsWith("--league-id=")) {
      const raw = a.slice("--league-id=".length).trim();
      leagueIds = new Set(raw.split(",").map((s) => s.trim()).filter(Boolean));
    }
  }
  return { dryRun, force, leagueIds };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const results = await finalizeAllRtss2026Champions(admin, {
    dryRun: args.dryRun,
    force: args.force,
    leagueIds: args.leagueIds,
  });

  const counts = { recorded: 0, skipped: 0, pending: 0, error: 0 };
  for (const r of results) {
    console.log(`[${r.status}] ${r.message}`);
    if (r.status in counts) counts[r.status as keyof typeof counts] += 1;
  }
  console.log("Done.", { leagues: results.length, ...counts, dryRun: args.dryRun });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
