/**
 * One-off audit: verify no existing league (TSP, Salary Cap, H2H) had its
 * roster rules or other league-level behavior changed by the R2WG deploy
 * (9b1beb3). Read-only; prints each league and diffs old-vs-new roster rules.
 *
 * Run: npx tsx scripts/audit-active-leagues-impact.ts
 */
import { config } from "dotenv";
config({ path: ".env" });

import { createClient } from "@supabase/supabase-js";
import {
  getRosterRulesForLeague,
  HEAD_TO_HEAD_ROSTER_RULES_BY_TEAMS,
  INCLUDE_NXT_ROSTER_RULES_BY_TEAMS,
  LEGACY_ROSTER_RULES_BY_TEAMS,
  RTS_BETA_ROSTER_RULES_3_TO_6,
  SALARY_CAP_MAX_ROSTER_SIZE,
  MIN_LEAGUE_TEAMS,
  MAX_LEAGUE_TEAMS,
  leagueUsesSalaryCap,
  leagueUsesHeadToHeadStyleRosterRules,
  ROAD_TO_SUMMERSLAM_SEASON_SLUG,
  type RosterRules,
} from "../lib/leagueStructure";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = createClient(url, key);

/** Roster rules exactly as computed before commit 9b1beb3 (copied from c9638ef). */
function oldRosterRules(
  teamCount: number,
  seasonSlug?: string | null,
  includeNxt?: boolean | null,
  leagueType?: string | null
): RosterRules | null {
  if (leagueUsesSalaryCap(leagueType)) {
    return { rosterSize: SALARY_CAP_MAX_ROSTER_SIZE, minFemale: 0, minMale: 0 };
  }
  if (teamCount < MIN_LEAGUE_TEAMS || teamCount > MAX_LEAGUE_TEAMS) return null;
  if (leagueUsesHeadToHeadStyleRosterRules(leagueType)) {
    return HEAD_TO_HEAD_ROSTER_RULES_BY_TEAMS[teamCount] ?? null;
  }
  if (includeNxt) {
    return INCLUDE_NXT_ROSTER_RULES_BY_TEAMS[teamCount] ?? null;
  }
  if (seasonSlug === ROAD_TO_SUMMERSLAM_SEASON_SLUG && teamCount >= 3 && teamCount <= 6) {
    return RTS_BETA_ROSTER_RULES_3_TO_6[teamCount] ?? null;
  }
  const legacyKey = teamCount < 7 ? 7 : teamCount;
  return LEGACY_ROSTER_RULES_BY_TEAMS[legacyKey] ?? null;
}

async function main() {
  const { data: leagues, error } = await admin
    .from("leagues")
    .select(
      "id, name, slug, season_slug, league_type, include_nxt, max_teams, start_date, end_date, visibility_type, draft_status"
    )
    .order("created_at", { ascending: true });
  if (error) throw error;

  const today = new Date().toISOString().slice(0, 10);
  let issues = 0;

  for (const lg of leagues ?? []) {
    const active = (lg.end_date ?? "9999-12-31") >= today;
    const { count } = await admin
      .from("league_members")
      .select("user_id", { count: "exact", head: true })
      .eq("league_id", lg.id);
    const teams = count ?? 0;

    const oldRules = oldRosterRules(teams, lg.season_slug, Boolean(lg.include_nxt), lg.league_type);
    const newRules = getRosterRulesForLeague(teams, lg.season_slug, Boolean(lg.include_nxt), lg.league_type);
    const same = JSON.stringify(oldRules) === JSON.stringify(newRules);

    const tag = active ? "ACTIVE" : "ended ";
    console.log(
      `[${tag}] ${lg.name} (${lg.slug}) | type=${lg.league_type} season=${lg.season_slug} nxt=${lg.include_nxt} teams=${teams}/${lg.max_teams} draft=${lg.draft_status} | ${lg.start_date}..${lg.end_date}`
    );
    if (!same) {
      issues++;
      console.log(
        `   >>> ROSTER RULES CHANGED: old=${JSON.stringify(oldRules)} new=${JSON.stringify(newRules)}`
      );
    }
  }

  console.log(
    issues === 0
      ? "\nNo roster-rule changes for any existing league ✅"
      : `\n${issues} league(s) with changed roster rules ❌`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
