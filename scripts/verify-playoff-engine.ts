/**
 * Standalone verification for the H2H schedule + playoff engine (sizes 4–8).
 * Run: npx tsx scripts/verify-playoff-engine.ts
 */
import {
  getRegularSeasonMatchupsForRound,
  getScheduledMatchupsForWeek,
  getPlayoffBracket,
  getPlayoffFinalStandings,
  playoffRoundsForSize,
  playoffWeekLabel,
  type WeeklyMatchupResult,
} from "@/lib/leagueMatchups";
import { getWeeksInRange, getSundayOfWeek } from "@/lib/fantasyWeekBounds";

let failures = 0;
function check(cond: boolean, msg: string) {
  if (!cond) {
    failures++;
    console.error("  ✗ " + msg);
  }
}

const FUTURE = "2027-01-01";
const weeks = getWeeksInRange("2026-08-03", "2026-11-28"); // 17 R2WG weeks
console.log(`Week grid: ${weeks.length} weeks (${weeks[0]} .. ${weeks[weeks.length - 1]})`);
check(weeks.length === 17, `R2WG full season should be 17 weeks (got ${weeks.length})`);

for (const size of [4, 5, 6, 7, 8]) {
  console.log(`\n=== ${size}-team league ===`);
  const order = Array.from({ length: size }, (_, i) => `u${i}`);
  // Constant per-team points => deterministic winners: u0 strongest.
  const strength: Record<string, number> = Object.fromEntries(order.map((id, i) => [id, 100 - i]));
  const weeklyResults: WeeklyMatchupResult[] = weeks.map((ws) => ({
    weekStart: ws,
    weekEnd: getSundayOfWeek(ws),
    pointsByUserId: { ...strength },
    winnerUserId: null,
    beltHolderUserId: null,
    beltRetained: false,
    weeklyWinPoints: 0,
    beltPoints: 0,
    weekScoringFinalized: true,
  }));

  const po = playoffRoundsForSize(size);
  const rsCount = weeks.length - po;
  check(po === (size === 4 ? 2 : 3), `${size}: playoff rounds = ${po}`);

  // --- Regular season structure + coverage ---
  const tripleCounts: Record<string, number> = Object.fromEntries(order.map((id) => [id, 0]));
  const cycle = size % 2 === 0 ? size - 1 : size;
  for (let r = 0; r < cycle; r++) {
    const mus = getRegularSeasonMatchupsForRound(order, r);
    const seen: Record<string, number> = {};
    let triples = 0;
    for (const mu of mus) {
      if (mu.type === "triple") {
        triples++;
        for (const id of mu.userIds) tripleCounts[id]!++;
      }
      check(mu.userIds.length === (mu.type === "triple" ? 3 : 2), `${size} r${r}: matchup size`);
      for (const id of mu.userIds) seen[id] = (seen[id] ?? 0) + 1;
    }
    check(triples === (size % 2 === 0 ? 0 : 1), `${size} r${r}: exactly ${size % 2 === 0 ? 0 : 1} triple threat(s) (got ${triples})`);
    // Every team appears exactly once per week (no byes, no doubles).
    const everyOnce = order.every((id) => seen[id] === 1);
    check(everyOnce, `${size} r${r}: every team plays exactly once`);
  }
  if (size % 2 === 1) {
    const vals = order.map((id) => tripleCounts[id]!);
    const spread = Math.max(...vals) - Math.min(...vals);
    console.log(`  triple-threat counts over ${cycle}-week cycle: ${JSON.stringify(tripleCounts)} (spread ${spread})`);
    check(spread <= 1, `${size}: triple-threat duty spread evenly (spread ${spread})`);
  }

  // --- Full single round-robin over the cycle (even sizes: each pair once) ---
  if (size % 2 === 0) {
    const pairSeen = new Set<string>();
    for (let r = 0; r < cycle; r++) {
      for (const mu of getRegularSeasonMatchupsForRound(order, r)) {
        const key = [...mu.userIds].sort().join("|");
        check(!pairSeen.has(key), `${size} r${r}: pair ${key} not repeated within a cycle`);
        pairSeen.add(key);
      }
    }
    check(pairSeen.size === (size * (size - 1)) / 2, `${size}: full round-robin covers all pairs (${pairSeen.size})`);
  }

  // --- Playoff schedule per week is 1v1 only ---
  for (let idx = rsCount; idx < weeks.length; idx++) {
    const mus = getScheduledMatchupsForWeek({
      weekStart: weeks[idx]!,
      weekStarts: weeks,
      memberUserIds: order,
      seededMemberUserIds: order,
      maxTeams: size,
      draftStatus: "completed",
      weeklyResults,
    });
    check(mus.length > 0, `${size}: playoff week ${idx + 1} has matchups`);
    check(mus.every((m) => m.type === "h2h"), `${size}: playoff week ${idx + 1} is all 1v1`);
    const label = playoffWeekLabel(idx + 1, weeks.length, size);
    check(label != null, `${size}: playoff week ${idx + 1} has a round label (${label})`);
  }
  // Last regular-season week is NOT labeled as playoffs.
  check(playoffWeekLabel(rsCount, weeks.length, size) === null, `${size}: last RS week has no playoff label`);

  // --- Bracket: champion + full placement ---
  const bracket = getPlayoffBracket({
    weekStarts: weeks,
    memberUserIds: order,
    seededMemberUserIds: order,
    maxTeams: size,
    draftStatus: "completed",
    weeklyResults,
    todayYmd: FUTURE,
  });
  check(bracket != null, `${size}: bracket built`);
  if (bracket) {
    check(bracket.seeds.length === size, `${size}: ${size} seeds`);
    check(bracket.champion?.userId === "u0", `${size}: top seed wins (champion=${bracket.champion?.userId})`);

    // Everyone ends with a final rank: appears in a final-week game or an auto placement.
    const ranked = new Set<string>();
    const lastChamp = bracket.championshipRounds[po - 1] ?? [];
    const lastPlace = bracket.placementRounds[po - 1] ?? [];
    for (const m of [...lastChamp, ...lastPlace]) {
      for (const t of m.teams) if (t.userId) ranked.add(t.userId);
    }
    for (const ap of bracket.autoPlacements) if (ap.team.userId) ranked.add(ap.team.userId);
    check(ranked.size === size, `${size}: every team gets a final rank (${ranked.size}/${size})`);

    const standings = getPlayoffFinalStandings(bracket);
    check(standings != null, `${size}: getPlayoffFinalStandings returns ranks`);
    if (standings) {
      check(standings.length === size, `${size}: standings length ${standings.length}`);
      check(standings[0]?.userId === "u0", `${size}: 1st place is champion u0`);
      check(standings.every((r, i) => r.rank === i + 1), `${size}: ranks are 1..N contiguous`);
    }

    const champLabels = bracket.roundLabels.join(" / ");
    console.log(`  round labels: ${champLabels}`);
    console.log(`  final places: ${[...lastChamp, ...lastPlace].map((m) => m.label).join(", ")}${bracket.autoPlacements.length ? ", " + bracket.autoPlacements.map((a) => a.label).join(", ") : ""}`);
  }
}

console.log(`\n${failures === 0 ? "ALL CHECKS PASSED ✅" : `${failures} CHECK(S) FAILED ❌`}`);
process.exit(failures === 0 ? 0 : 1);
