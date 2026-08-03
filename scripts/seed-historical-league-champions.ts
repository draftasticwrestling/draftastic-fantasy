/**
 * Seed championship placements for finished admin/test leagues (including archived).
 * Used so account Championship Belts show historical wins (e.g. Kayfabe King test leagues).
 *
 * Usage:
 *   npx tsx scripts/seed-historical-league-champions.ts
 *   npx tsx scripts/seed-historical-league-champions.ts --dry-run
 *   npx tsx scripts/seed-historical-league-champions.ts --slug=draftastic-test-2,season-points-test
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import {
  finalizeLeagueChampionPlacement,
  resolveLeagueChampionAllowIncompleteDraft,
  seasonKeyForLeague,
  type LeagueForPlacementResolve,
} from "../lib/leagueSeasonPlacements";
import { isPastEndOfDayPst } from "../lib/pstCivilTime";

const DEFAULT_SLUGS = ["draftastic-test-2", "season-points-test"];

function parseArgs(argv: string[]): { dryRun: boolean; slugs: string[] } {
  let dryRun = false;
  let slugs = [...DEFAULT_SLUGS];
  for (const a of argv) {
    if (a === "--dry-run") dryRun = true;
    else if (a.startsWith("--slug=")) {
      slugs = a
        .slice("--slug=".length)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }
  return { dryRun, slugs };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing SUPABASE env");
    process.exit(1);
  }
  const admin = createClient(url, key, { auth: { persistSession: false } });

  const { data: leagues, error } = await admin
    .from("leagues")
    .select(
      "id, name, slug, league_type, draft_type, season_slug, start_date, end_date, draft_date, draft_status, max_teams, visibility_type, is_archived"
    )
    .in("slug", args.slugs);
  if (error) {
    console.error(error.message);
    process.exit(1);
  }

  for (const raw of leagues ?? []) {
    const league = raw as LeagueForPlacementResolve;
    const endYmd = (league.end_date ?? "").slice(0, 10);
    if (!endYmd || !isPastEndOfDayPst(endYmd)) {
      console.log(`[skip] ${league.slug}: season not past end (${endYmd})`);
      continue;
    }

    const seasonKey = seasonKeyForLeague(league);
    // Force draft completed for resolve so archived/test leagues with odd draft_status still count.
    const champion = await resolveLeagueChampionAllowIncompleteDraft(league, admin);
    if (!champion) {
      console.log(`[pending] ${league.slug}: no champion resolved`);
      continue;
    }

    const result = await finalizeLeagueChampionPlacement(
      admin,
      { ...league, draft_status: "completed" },
      { seasonKey, dryRun: args.dryRun, force: true }
    );
    console.log(`[${result.status}] ${result.message} seasonKey=${seasonKey}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
