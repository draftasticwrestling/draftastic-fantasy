/**
 * Pure mock-draft rules. The practice room runs these in the browser so a pick
 * never calls a serverless function.
 */

import {
  getRosterRulesForLeague,
  ROAD_TO_WAR_GAMES_SEASON_SLUG,
  type RosterRules,
} from "@/lib/leagueStructure";

/** Kept so practice drafts saved before the format picker was removed still open. */
export type MockLeagueFormat = "head_to_head" | "season_overall";

export const MOCK_TEAM_MIN = 3;
export const MOCK_TEAM_MAX = 8;

export type MockGender = "M" | "F" | "U";

export type MockBrand = "Raw" | "SmackDown" | "NXT" | "Other";

export type MockDraftWrestler = {
  id: string;
  name: string;
  gender: MockGender;
  brand: MockBrand;
  imageUrl: string | null;
  injured: boolean;
  /** 2026 fantasy points from the precomputed stats cache. */
  points: number;
  /** 1 = highest 2026 points in this pool. */
  rank: number;
};

export type CpuStyle = "best" | "women" | "men" | "brand";

export type SnakePick = {
  overall: number;
  round: number;
  /** 1-based position along the snake in this round (round 2's last pick is team count). */
  pickInRound: number;
  /** 0-based round-1 slot. Slot 0 picks first in round 1. */
  teamIndex: number;
};

/**
 * Roster size for a practice draft. Head-to-Head and Total Season Points use this
 * same ladder in Road to War Games, so the mock does not ask which format you play.
 */
export function mockRosterRules(teamCount: number): RosterRules | null {
  if (teamCount < MOCK_TEAM_MIN || teamCount > MOCK_TEAM_MAX) return null;
  return getRosterRulesForLeague(teamCount, ROAD_TO_WAR_GAMES_SEASON_SLUG, true, "head_to_head");
}

/** Snake order used by live leagues: round 1 is slot order, each even round reverses. */
export function buildSnakePicks(teamCount: number, rounds: number): SnakePick[] {
  const picks: SnakePick[] = [];
  let overall = 1;
  const slots = Array.from({ length: teamCount }, (_, i) => i);
  for (let round = 1; round <= rounds; round++) {
    const order = round % 2 === 0 ? [...slots].reverse() : slots;
    order.forEach((teamIndex, idx) => {
      picks.push({
        overall,
        round,
        pickInRound: idx + 1,
        teamIndex,
      });
      overall += 1;
    });
  }
  return picks;
}

export function genderNeeded(
  rules: Pick<RosterRules, "rosterSize" | "minFemale" | "minMale">,
  roster: { gender: MockGender }[]
): "M" | "F" | null {
  const remaining = rules.rosterSize - roster.length;
  if (remaining <= 0) return null;
  const females = roster.filter((w) => w.gender === "F").length;
  const males = roster.filter((w) => w.gender === "M").length;
  const needFemale = Math.max(0, rules.minFemale - females);
  const needMale = Math.max(0, rules.minMale - males);
  if (needFemale > 0 && remaining - 1 < needFemale) return "F";
  if (needMale > 0 && remaining - 1 < needMale) return "M";
  return null;
}

export function cpuStyleForTeam(teamIndex: number): CpuStyle {
  const styles: CpuStyle[] = ["best", "women", "men", "brand"];
  return styles[teamIndex % styles.length];
}

function byPoints(a: MockDraftWrestler, b: MockDraftWrestler): number {
  return b.points - a.points || a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
}

function firstListed(ids: readonly string[] | undefined, candidates: readonly MockDraftWrestler[]): string | null {
  if (!ids) return null;
  for (const id of ids) {
    if (candidates.some((wrestler) => wrestler.id === id)) return id;
  }
  return null;
}

/**
 * Next wrestler for a seat. The user's queue is consulted only when `useQueue` is set.
 * If nobody on that queue is still available, `fallbackQueue` (the Default Big Board) is next.
 * A required gender is honored when anyone of that gender is still available.
 */
export function chooseWrestler(opts: {
  pool: MockDraftWrestler[];
  draftedIds: ReadonlySet<string>;
  roster: MockDraftWrestler[];
  rules: Pick<RosterRules, "rosterSize" | "minFemale" | "minMale">;
  style: CpuStyle;
  queue?: readonly string[];
  fallbackQueue?: readonly string[];
  useQueue?: boolean;
}): string | null {
  const available = opts.pool.filter((w) => !opts.draftedIds.has(w.id));
  if (available.length === 0) return null;
  const need = genderNeeded(opts.rules, opts.roster);
  const legal = need ? available.filter((w) => w.gender === need) : available;
  const candidates = legal.length > 0 ? legal : available;

  if (opts.useQueue) {
    const fromQueue = firstListed(opts.queue, candidates);
    if (fromQueue) return fromQueue;
    const fromDefault = firstListed(opts.fallbackQueue, candidates);
    if (fromDefault) return fromDefault;
  }

  const sorted = [...candidates].sort(byPoints);
  const best = sorted[0];
  if (!best) return null;
  if (opts.style === "best") return best.id;

  if (opts.style === "women" || opts.style === "men") {
    const gender: MockGender = opts.style === "women" ? "F" : "M";
    if (need && need !== gender) return best.id;
    const biased = sorted.find((w) => w.gender === gender);
    if (biased && biased.points >= best.points * 0.8) return biased.id;
    return best.id;
  }

  const raw = opts.roster.filter((w) => w.brand === "Raw").length;
  const smackdown = opts.roster.filter((w) => w.brand === "SmackDown").length;
  const prefer: MockBrand = raw <= smackdown ? "Raw" : "SmackDown";
  const brandPick = sorted.find((w) => w.brand === prefer);
  if (brandPick && brandPick.points >= best.points * 0.75) return brandPick.id;
  return best.id;
}

export function rosterForTeam(
  pickIds: readonly (string | null)[],
  snake: readonly SnakePick[],
  teamIndex: number,
  byId: ReadonlyMap<string, MockDraftWrestler>
): MockDraftWrestler[] {
  const roster: MockDraftWrestler[] = [];
  for (let i = 0; i < pickIds.length; i++) {
    const id = pickIds[i];
    if (!id || snake[i]?.teamIndex !== teamIndex) continue;
    const wrestler = byId.get(id);
    if (wrestler) roster.push(wrestler);
  }
  return roster;
}

export function draftedIdSet(pickIds: readonly (string | null)[]): Set<string> {
  const ids = new Set<string>();
  for (const id of pickIds) {
    if (id) ids.add(id);
  }
  return ids;
}

/** Fill computer seats until the user's next pick. The user's queue is left untouched. */
export function fillCpuUntilUser(opts: {
  pickIds: readonly (string | null)[];
  snake: readonly SnakePick[];
  userTeam: number;
  pool: MockDraftWrestler[];
  rules: Pick<RosterRules, "rosterSize" | "minFemale" | "minMale">;
}): (string | null)[] {
  const next = opts.pickIds.slice();
  const byId = new Map(opts.pool.map((w) => [w.id, w]));
  for (let i = 0; i < next.length; i++) {
    if (next[i] != null) continue;
    const seat = opts.snake[i];
    if (!seat || seat.teamIndex === opts.userTeam) break;
    const id = chooseWrestler({
      pool: opts.pool,
      draftedIds: draftedIdSet(next),
      roster: rosterForTeam(next, opts.snake, seat.teamIndex, byId),
      rules: opts.rules,
      style: cpuStyleForTeam(seat.teamIndex),
    });
    if (!id) break;
    next[i] = id;
  }
  return next;
}

/** Finish every remaining pick. The user's queue is used on their turns, then the default board. */
export function fillRemainingPicks(opts: {
  pickIds: readonly (string | null)[];
  snake: readonly SnakePick[];
  userTeam: number;
  pool: MockDraftWrestler[];
  rules: Pick<RosterRules, "rosterSize" | "minFemale" | "minMale">;
  queue: readonly string[];
  fallbackQueue?: readonly string[];
}): { pickIds: (string | null)[]; queue: string[] } {
  const next = opts.pickIds.slice();
  const queue = opts.queue.slice();
  const byId = new Map(opts.pool.map((w) => [w.id, w]));
  for (let i = 0; i < next.length; i++) {
    if (next[i] != null) continue;
    const seat = opts.snake[i];
    if (!seat) break;
    const isUser = seat.teamIndex === opts.userTeam;
    const id = chooseWrestler({
      pool: opts.pool,
      draftedIds: draftedIdSet(next),
      roster: rosterForTeam(next, opts.snake, seat.teamIndex, byId),
      rules: opts.rules,
      style: isUser ? "best" : cpuStyleForTeam(seat.teamIndex),
      queue,
      fallbackQueue: opts.fallbackQueue,
      useQueue: isUser,
    });
    if (!id) break;
    next[i] = id;
    if (isUser) {
      const at = queue.indexOf(id);
      if (at >= 0) queue.splice(at, 1);
    }
  }
  return { pickIds: next, queue };
}

export function currentPickIndex(pickIds: readonly (string | null)[]): number {
  const idx = pickIds.findIndex((id) => id == null);
  return idx;
}

export function formatPickClock(seconds: number): string {
  const safe = Math.max(0, seconds);
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function formatPoints(points: number): string {
  const rounded = Math.round(points * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}
