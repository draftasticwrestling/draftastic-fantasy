import { draftEquivalentSlugs } from "@/lib/scoring/personaResolution.js";
import { normalizeWrestlerName } from "@/lib/scoring/parsers/participantParser.js";
import { getPointsForWrestler } from "@/lib/scoring/aggregateWrestlerPoints.js";
import {
  getMatchStatsForWrestler,
  getUnparsedMatchesForWrestler,
} from "@/lib/scoring/aggregateWrestlerMatchStats.js";
import { getMonthlyBeltForWrestler } from "@/lib/scoring/endOfMonthBeltPoints.js";

type PointsTriple = { rsPoints: number; plePoints: number; beltPoints: number };
type MatchStatsRow = { mw: number; win: number; loss: number; nc: number; dqw: number; dql: number };

const ZERO_POINTS: PointsTriple = { rsPoints: 0, plePoints: 0, beltPoints: 0 };
const ZERO_STATS: MatchStatsRow = { mw: 0, win: 0, loss: 0, nc: 0, dqw: 0, dql: 0 };

function slugKeysForAliasMerge(slugKey: string): string[] {
  return draftEquivalentSlugs(slugKey);
}

/**
 * Sum fantasy points across Pete Dunne + Rayo Americano (etc.) so list rows keyed by the gimmick slug match scoring (canonical keys).
 */
export function mergeGetPointsForWrestler(
  pointsBySlug: Record<string, PointsTriple>,
  slugKey: string,
  nameKey: string
): PointsTriple {
  const keys = slugKeysForAliasMerge(slugKey);
  if (keys.length <= 1) return getPointsForWrestler(pointsBySlug, slugKey, nameKey);
  let rs = 0;
  let ple = 0;
  let belt = 0;
  for (const s of keys) {
    const nk = normalizeWrestlerName(String(s));
    const p = getPointsForWrestler(pointsBySlug, s, nk || nameKey);
    rs += p.rsPoints;
    ple += p.plePoints;
    belt += p.beltPoints;
  }
  return { rsPoints: rs, plePoints: ple, beltPoints: belt };
}

/** Merge match wins/losses etc. across draft alias group (same canonical attribution as points). */
export function mergeGetMatchStatsForWrestler(
  statsBySlug: Record<string, MatchStatsRow>,
  slugKey: string,
  nameKey: string
): MatchStatsRow {
  const keys = slugKeysForAliasMerge(slugKey);
  if (keys.length <= 1) return getMatchStatsForWrestler(statsBySlug, slugKey, nameKey);
  const out = { ...ZERO_STATS };
  for (const s of keys) {
    const nk = normalizeWrestlerName(String(s));
    const r = getMatchStatsForWrestler(statsBySlug, s, nk || nameKey);
    out.mw += r.mw;
    out.win += r.win;
    out.loss += r.loss;
    out.nc += r.nc;
    out.dqw += r.dqw;
    out.dql += r.dql;
  }
  return out;
}

/** Sum hybrid monthly/weekly belt hold points across all slugs in the draft alias group. */
export function mergeGetMonthlyBeltForWrestler(
  bySlug: Record<string, number>,
  slugKey: string,
  nameKey: string,
  refDateYmd?: string
): number {
  const keys = slugKeysForAliasMerge(slugKey);
  if (keys.length <= 1) return getMonthlyBeltForWrestler(bySlug, slugKey, nameKey, refDateYmd);
  let sum = 0;
  for (const s of keys) {
    const nk = normalizeWrestlerName(String(s));
    sum += getMonthlyBeltForWrestler(bySlug, s, nk || nameKey, refDateYmd);
  }
  return sum;
}

/** Championship labels may be keyed under canonical slug; merge for display on persona primary row. */
export function mergeCurrentChampionTitleStrings(
  currentChampionsBySlug: Record<string, string[]>,
  slugKey: string,
  nameKey: string
): string[] {
  const keys = slugKeysForAliasMerge(slugKey);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of keys) {
    const nk = normalizeWrestlerName(String(s));
    const lists = [
      currentChampionsBySlug[s],
      currentChampionsBySlug[nk],
      s === slugKey ? currentChampionsBySlug[nameKey] : undefined,
    ];
    for (const list of lists) {
      if (!Array.isArray(list)) continue;
      for (const t of list) {
        if (t && !seen.has(t)) {
          seen.add(t);
          out.push(t);
        }
      }
    }
  }
  return out;
}

/** First non-empty current-champion cell from championships table or changes (keys often canonical). */
export function mergeGetCurrentChampionFromMap<T>(
  map: Record<string, T | null | undefined>,
  slugKey: string,
  nameKey: string
): T | undefined {
  for (const s of slugKeysForAliasMerge(slugKey)) {
    const nk = normalizeWrestlerName(String(s));
    const hit = (map[nk] ?? map[s] ?? (s === slugKey ? map[nameKey] : undefined)) as T | null | undefined;
    if (hit != null && hit !== undefined) return hit;
  }
  return undefined;
}

/** Unparsed match notifications keyed by canonical slug; dedupe by event when merging aliases. */
export function mergeUnparsedMatchCount(
  unparsedBySlug: Record<string, { eventId: string; eventName: string; eventDate: string }[]>,
  slugKey: string,
  nameKey: string
): number {
  const keys = slugKeysForAliasMerge(slugKey);
  if (keys.length <= 1) return getUnparsedMatchesForWrestler(unparsedBySlug, slugKey, nameKey).length;
  const seen = new Set<string>();
  for (const s of keys) {
    const nk = normalizeWrestlerName(String(s));
    for (const item of getUnparsedMatchesForWrestler(unparsedBySlug, s, nk || nameKey)) {
      seen.add(`${item.eventId}\0${item.eventDate}`);
    }
  }
  return seen.size;
}
