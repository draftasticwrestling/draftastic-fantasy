/**
 * One-off / maintenance: grant XP from historical league data using the same
 * idempotency keys as production, so the script is safe to re-run.
 *
 * Usage:
 *   npx tsx scripts/backfill-user-xp-from-history.ts
 *   npx tsx scripts/backfill-user-xp-from-history.ts --dry-run
 *   npx tsx scripts/backfill-user-xp-from-history.ts --user-id=<uuid>[,uuid...]
 *   npx tsx scripts/backfill-user-xp-from-history.ts --league-id=<uuid>[,uuid...]
 *   npx tsx scripts/backfill-user-xp-from-history.ts --placements-file=./scripts/xp-placements-backfill.json
 *
 * Placements JSON shape:
 *   { "placements": [
 *       { "userId": "uuid", "leagueId": "uuid", "seasonKey": "road-to-summerslam-2026",
 *         "placement": 1, "teamCount": 4 }
 *     ] }
 * teamCount must be 3–6; placement must be 1 or 2.
 */
import "dotenv/config";
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { applyXpGrant } from "../lib/xp/applyXpGrant";
import { applyLeaguePlacementXp, type LeagueTeamCount } from "../lib/xp/leaguePlacementGrants";
import { XP_AMOUNTS } from "../lib/xp/xpReasons";
import { getPointsByOwnerForLeagueWithBonuses } from "../lib/leagueMatchups";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

type Args = {
  dryRun: boolean;
  userIds: Set<string> | null;
  leagueIds: Set<string> | null;
  placementsFile: string | null;
  autoPlacements: boolean;
};

function printHelp(): void {
  console.log(`backfill-user-xp-from-history — grant XP from DB history (idempotent).

  npm run xp:backfill-history -- --dry-run
  npm run xp:backfill-history -- --user-id=<uuid>[,uuid...]
  npm run xp:backfill-history -- --league-id=<uuid>[,uuid...]
  npm run xp:backfill-history -- --placements-file=./path.json
  npm run xp:backfill-history -- --auto-placements

  Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
  Scope with --user-id and/or --league-id when backfilling test accounts only.`);
}

function parseArgs(argv: string[]): Args {
  let dryRun = false;
  let userIds: Set<string> | null = null;
  let leagueIds: Set<string> | null = null;
  let placementsFile: string | null = null;
  let autoPlacements = false;
  for (const a of argv) {
    if (a === "--help" || a === "-h") {
      printHelp();
      process.exit(0);
    }
    if (a === "--dry-run") dryRun = true;
    else if (a.startsWith("--user-id=")) {
      const raw = a.slice("--user-id=".length).trim();
      userIds = new Set(raw.split(",").map((s) => s.trim()).filter(Boolean));
    } else if (a.startsWith("--league-id=")) {
      const raw = a.slice("--league-id=".length).trim();
      leagueIds = new Set(raw.split(",").map((s) => s.trim()).filter(Boolean));
    } else if (a.startsWith("--placements-file=")) {
      placementsFile = a.slice("--placements-file=".length).trim() || null;
    } else if (a === "--auto-placements") {
      autoPlacements = true;
    }
  }
  return { dryRun, userIds, leagueIds, placementsFile, autoPlacements };
}

function wantUser(userId: string, filter: Set<string> | null): boolean {
  return !filter || filter.has(userId);
}

function wantLeague(leagueId: string, filter: Set<string> | null): boolean {
  return !filter || filter.has(leagueId);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const counts = {
    league_started: 0,
    league_joined: 0,
    trade_executed: 0,
    free_agent_move: 0,
    placement: 0,
  };

  const log = (msg: string) => console.log(args.dryRun ? `[dry-run] ${msg}` : msg);

  const { data: leagues, error: leaguesErr } = await admin.from("leagues").select("id, commissioner_id");
  if (leaguesErr) {
    console.error(leaguesErr.message);
    process.exit(1);
  }

  const leagueRows = (leagues ?? []) as { id: string; commissioner_id: string | null }[];
  const commissionerByLeague = new Map<string, string | null>();
  for (const l of leagueRows) {
    commissionerByLeague.set(l.id, l.commissioner_id ?? null);
  }

  let leaguesToProcess = leagueRows;
  if (args.leagueIds) {
    leaguesToProcess = leagueRows.filter((l) => args.leagueIds!.has(l.id));
  }

  for (const l of leaguesToProcess) {
    const cid = l.commissioner_id;
    if (!cid || !wantUser(cid, args.userIds)) continue;
    log(`league_started league=${l.id} user=${cid} +${XP_AMOUNTS.league_started}`);
    if (!args.dryRun) {
      await applyXpGrant(admin, {
        userId: cid,
        delta: XP_AMOUNTS.league_started,
        reason: "league_started",
        idempotencyKey: `league_started:${l.id}`,
        metadata: { leagueId: l.id, backfill: true },
      });
    }
    counts.league_started += 1;
  }

  const { data: members, error: memErr } = await admin.from("league_members").select("league_id, user_id");
  if (memErr) {
    console.error(memErr.message);
    process.exit(1);
  }

  for (const m of (members ?? []) as { league_id: string; user_id: string }[]) {
    if (!wantLeague(m.league_id, args.leagueIds)) continue;
    const comm = commissionerByLeague.get(m.league_id);
    if (m.user_id === comm) continue;
    if (!wantUser(m.user_id, args.userIds)) continue;
    log(`league_joined league=${m.league_id} user=${m.user_id} +${XP_AMOUNTS.league_joined}`);
    if (!args.dryRun) {
      await applyXpGrant(admin, {
        userId: m.user_id,
        delta: XP_AMOUNTS.league_joined,
        reason: "league_joined",
        idempotencyKey: `league_joined:${m.user_id}:${m.league_id}`,
        metadata: { leagueId: m.league_id, backfill: true },
      });
    }
    counts.league_joined += 1;
  }

  const { data: trades, error: tradeErr } = await admin
    .from("league_trade_proposals")
    .select("id, league_id, from_user_id, to_user_id, executed_at")
    .not("executed_at", "is", null);
  if (tradeErr) {
    console.error(tradeErr.message);
    process.exit(1);
  }

  for (const t of (trades ?? []) as {
    id: string;
    league_id: string;
    from_user_id: string;
    to_user_id: string;
    executed_at: string | null;
  }[]) {
    if (!wantLeague(t.league_id, args.leagueIds)) continue;
    for (const uid of [t.from_user_id, t.to_user_id]) {
      if (!wantUser(uid, args.userIds)) continue;
      log(`trade_executed proposal=${t.id} user=${uid} +${XP_AMOUNTS.trade_executed}`);
      if (!args.dryRun) {
        await applyXpGrant(admin, {
          userId: uid,
          delta: XP_AMOUNTS.trade_executed,
          reason: "trade_executed",
          idempotencyKey: `trade_executed:${t.id}:${uid}`,
          metadata: { proposalId: t.id, leagueId: t.league_id, backfill: true },
        });
      }
      counts.trade_executed += 1;
    }
  }

  const { data: faRows, error: faErr } = await admin
    .from("league_activity")
    .select("id, league_id, user_id, activity_type")
    .eq("activity_type", "fa_add");
  if (faErr) {
    console.error(faErr.message);
    process.exit(1);
  }

  for (const r of (faRows ?? []) as { id: string; league_id: string; user_id: string }[]) {
    if (!wantLeague(r.league_id, args.leagueIds)) continue;
    if (!wantUser(r.user_id, args.userIds)) continue;
    log(`free_agent_move activity=${r.id} user=${r.user_id} +${XP_AMOUNTS.free_agent_move}`);
    if (!args.dryRun) {
      await applyXpGrant(admin, {
        userId: r.user_id,
        delta: XP_AMOUNTS.free_agent_move,
        reason: "free_agent_move",
        idempotencyKey: `fa_add:${r.id}`,
        metadata: { leagueId: r.league_id, activityId: r.id, backfill: true },
      });
    }
    counts.free_agent_move += 1;
  }

  if (args.placementsFile) {
    const raw = await readFile(args.placementsFile, "utf8");
    const parsed = JSON.parse(raw) as {
      placements?: Array<{
        userId: string;
        leagueId: string;
        seasonKey: string;
        placement: number;
        teamCount: number;
      }>;
    };
    const rows = parsed.placements ?? [];
    for (const p of rows) {
      const teamCount = p.teamCount as LeagueTeamCount;
      if (![3, 4, 5, 6].includes(teamCount)) {
        console.error(`Invalid teamCount for user ${p.userId}: ${p.teamCount}`);
        process.exit(1);
      }
      if (p.placement !== 1 && p.placement !== 2) {
        console.error(`Invalid placement for user ${p.userId}: ${p.placement}`);
        process.exit(1);
      }
      if (!wantUser(p.userId, args.userIds)) continue;
      if (!wantLeague(p.leagueId, args.leagueIds)) continue;
      log(
        `placement league=${p.leagueId} user=${p.userId} season=${p.seasonKey} place=${p.placement} teams=${teamCount}`
      );
      if (!args.dryRun) {
        await applyLeaguePlacementXp(admin, {
          userId: p.userId,
          leagueId: p.leagueId,
          seasonKey: p.seasonKey,
          placement: p.placement as 1 | 2,
          teamCount,
        });
      }
      counts.placement += 1;
    }
  }

  if (args.autoPlacements) {
    const today = new Date().toISOString().slice(0, 10);
    for (const l of leaguesToProcess) {
      const { data: league } = await admin
        .from("leagues")
        .select("season_slug, end_date")
        .eq("id", l.id)
        .maybeSingle();
      const seasonKey = String((league as { season_slug?: string | null } | null)?.season_slug ?? "").trim();
      const endDate = String((league as { end_date?: string | null } | null)?.end_date ?? "").slice(0, 10);
      if (!seasonKey || !endDate || endDate >= today) continue;

      const { data: members } = await admin.from("league_members").select("user_id").eq("league_id", l.id);
      const teamCount = (members ?? []).length as LeagueTeamCount;
      if (![3, 4, 5, 6].includes(teamCount)) continue;

      const pointsByUserId = await getPointsByOwnerForLeagueWithBonuses(l.id, admin);
      const ranked = Object.entries(pointsByUserId).sort((a, b) => b[1] - a[1]);
      if (ranked.length < 2) continue;

      const [firstUserId, firstPts] = ranked[0]!;
      const [secondUserId, secondPts] = ranked[1]!;
      const thirdPts = ranked[2]?.[1];
      if (!Number.isFinite(firstPts) || !Number.isFinite(secondPts)) continue;
      if (firstPts <= 0 || secondPts <= 0) continue;
      if (thirdPts != null && thirdPts === secondPts) {
        // Tie for second place: skip auto-award to avoid granting placement incorrectly.
        log(`placement skipped league=${l.id} reason=tie_for_second first=${firstPts} second=${secondPts} third=${thirdPts}`);
        continue;
      }

      for (const [uid, placement] of [
        [firstUserId, 1],
        [secondUserId, 2],
      ] as const) {
        if (!wantUser(uid, args.userIds)) continue;
        log(`placement(auto) league=${l.id} user=${uid} season=${seasonKey} place=${placement} teams=${teamCount}`);
        if (!args.dryRun) {
          await applyLeaguePlacementXp(admin, {
            userId: uid,
            leagueId: l.id,
            seasonKey,
            placement,
            teamCount,
          });
        }
        counts.placement += 1;
      }
    }
  }

  console.log("Done.", counts);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
