/**
 * Last-N wrestler matches + W/L/D outcomes (aligned with Pro Wrestling Boxscore matchOutcomes.js).
 * Used for wrestler profile "Last 5 matches" vs full event timeline.
 */

export type WrestlerMapEntry = { name: string | null };

/** Same as PWBS App.jsx: one entry per `wrestlers.id` only (slug key). */
export function buildPwbsWrestlerMap(wrestlers: ReadonlyArray<{ id: string; name?: string | null }>): Record<string, WrestlerMapEntry> {
  const map: Record<string, WrestlerMapEntry> = {};
  for (const w of wrestlers) {
    const id = String(w.id ?? "").trim();
    if (!id) continue;
    map[id] = { name: w.name != null ? String(w.name) : null };
  }
  return map;
}

/** Slugs used to detect participation (PWBS uses URL `slug` = wrestlers.id; we also allow URL param when it differs). */
export function getProfileParticipationSlugs(wrestlerId: string, urlSlug: string): string[] {
  const a = String(wrestlerId ?? "").trim();
  const b = String(urlSlug ?? "").trim();
  if (a && b && a !== b) return [a, b];
  return a ? [a] : b ? [b] : [];
}

/** PWBS id-keyed map + profile id/url aliases so `didWrestlerParticipate` sees the same names as Boxscore. */
export function enrichProfileWrestlerMap(
  idKeyedWrestlerMap: Record<string, WrestlerMapEntry>,
  wrestlerId: string,
  urlSlug: string,
  wrestlerName: string | null
): Record<string, WrestlerMapEntry> {
  const map: Record<string, WrestlerMapEntry> = { ...idKeyedWrestlerMap };
  const id = String(wrestlerId ?? "").trim();
  const slug = String(urlSlug ?? "").trim();
  const name = wrestlerName != null ? String(wrestlerName) : null;
  if (id) map[id] = { name };
  if (slug && slug !== id) map[slug] = { name };
  return map;
}

const EXCLUDED_STATS_MATCH_PATTERNS = [
  "royal rumble",
  "battle royal",
  "elimination chamber",
  "survivor series",
  "war games",
  "gauntlet match",
];

/** Mirrors PWBS `shouldShowLastFiveStats` (Statistics tab / crowded matches). */
export function shouldShowLastFiveStats(match: TimelineMatch | null | undefined, maxParticipantCount = 10): boolean {
  if (!match) return false;
  const mt = String(match.matchType || "").toLowerCase();
  if (EXCLUDED_STATS_MATCH_PATTERNS.some((p) => mt.includes(p))) return false;
  const slugs = extractWrestlerSlugs(match.participants);
  return slugs.size <= maxParticipantCount;
}

export type TimelineEvent = {
  id: string;
  name?: string | null;
  date?: string | null;
  location?: string | null;
  status?: string | null;
  matches?: unknown[] | null;
};

export type TimelineMatch = Record<string, unknown>;

export function getSortedMatchesForEvent(event: TimelineEvent): TimelineMatch[] {
  const base = Array.isArray(event.matches) ? event.matches : [];
  const withDefaultOrder = base.map((m, idx) => {
    const row = m as TimelineMatch;
    return { ...row, order: (row.order as number) || idx + 1 };
  });
  return [...withDefaultOrder].sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
}

export function extractWrestlerSlugs(participants: unknown): Set<string> {
  const slugs = new Set<string>();
  if (!participants) return slugs;
  if (Array.isArray(participants)) {
    participants.forEach((slug) => {
      if (slug && typeof slug === "string") slugs.add(slug.trim());
    });
    return slugs;
  }
  if (typeof participants !== "string") return slugs;
  const sides = participants.split(" vs ");
  sides.forEach((side) => {
    const teamMatch = side.match(/^([^(]+)\s*\(([^)]+)\)$/);
    if (teamMatch) {
      teamMatch[2]
        .split("&")
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((slug) => slugs.add(slug));
    } else {
      side
        .split("&")
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((slug) => slugs.add(slug));
    }
  });
  return slugs;
}

function parseEventDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return new Date(dateStr + "T12:00:00");
  const parsed = new Date(dateStr);
  return !Number.isNaN(parsed.getTime()) ? parsed : null;
}

function normalizeText(s: string): string {
  return (s || "").toLowerCase().trim().replace(/\s+/g, " ");
}

function includesName(text: string | undefined, wrestlerName: string | undefined): boolean {
  if (!text || !wrestlerName) return false;
  const hay = normalizeText(text);
  const needle = normalizeText(wrestlerName);
  return !!needle && hay.includes(needle);
}

export function didWrestlerParticipate(
  match: TimelineMatch,
  wrestlerSlug: string,
  wrestlerMap: Record<string, WrestlerMapEntry>
): boolean {
  const wrestlerName = wrestlerMap[wrestlerSlug]?.name ?? undefined;
  const participantSlugs = extractWrestlerSlugs(match.participants);
  if (participantSlugs.has(wrestlerSlug)) return true;

  if (wrestlerName) {
    if (typeof match.participants === "string" && includesName(match.participants, wrestlerName)) return true;
    if (includesName(match.result as string | undefined, wrestlerName)) return true;
    if (includesName(match.winner as string | undefined, wrestlerName)) return true;
  }

  return false;
}

const DRAW_RESULT_PHRASES = [
  "no contest",
  "no winner",
  "draw",
  "double count out",
  "double dq",
  "double disqualification",
  "time limit draw",
  "countout draw",
];
const DRAW_METHODS = ["No Contest", "Double Count Out", "Draw"];

export function isDrawResult(result: unknown, method: unknown): boolean {
  const r = String(result || "")
    .toLowerCase()
    .trim();
  if (DRAW_RESULT_PHRASES.some((phrase) => r.includes(phrase))) return true;
  if (method && DRAW_METHODS.includes(String(method))) return true;
  return false;
}

export type MatchOutcome = "W" | "L" | "D";

export function getMatchOutcome(
  match: TimelineMatch,
  wrestlerSlug: string,
  wrestlerMap: Record<string, WrestlerMapEntry>
): MatchOutcome {
  const wrestlerName = wrestlerMap[wrestlerSlug]?.name ?? undefined;
  const participantSlugs = extractWrestlerSlugs(match.participants);
  const wasInMatch = didWrestlerParticipate(match, wrestlerSlug, wrestlerMap);

  const winner = match.winner;
  if (winner) {
    if (winner === wrestlerSlug) return "W";
    const winnerSlugs = extractWrestlerSlugs(winner);
    if (winnerSlugs.has(wrestlerSlug)) return "W";
    if (wrestlerName && includesName(String(winner), wrestlerName)) return "W";
    if (wasInMatch) return "L";
    return "D";
  }

  if (isDrawResult(match.result, match.method)) return "D";

  const resultStr = String(match.result || "");
  if (!resultStr || !resultStr.includes(" def. ")) {
    if (wasInMatch) return "L";
    return "D";
  }

  const [winnerSide, loserSide] = resultStr.split(" def. ").map((s) => s.trim());
  const winnerSlugs = extractWrestlerSlugs(winnerSide);
  const loserSlugs = new Set<string>();
  loserSide.split(/\s+and\s+|\s*&\s+/).forEach((part) => {
    extractWrestlerSlugs(part.trim()).forEach((s) => loserSlugs.add(s));
  });
  if (loserSlugs.size === 0) extractWrestlerSlugs(loserSide).forEach((s) => loserSlugs.add(s));

  if (winnerSlugs.has(wrestlerSlug) || (wrestlerName && includesName(winnerSide, wrestlerName))) return "W";
  if (loserSlugs.has(wrestlerSlug) || (wrestlerName && includesName(loserSide, wrestlerName))) return "L";
  if (wasInMatch) return "L";
  return "D";
}

export type ChronologicalMatchItem = {
  event: TimelineEvent;
  match: TimelineMatch;
  matchIndex: number;
};

export function buildChronologicalWrestlerMatchList(
  events: TimelineEvent[],
  profileSlugs: string[],
  wrestlerMap: Record<string, WrestlerMapEntry>
): ChronologicalMatchItem[] {
  const list: ChronologicalMatchItem[] = [];
  const slugSet = profileSlugs.filter(Boolean);
  const sortedEvents = [...(events || [])].sort((a, b) => {
    const da = parseEventDate(a.date ?? undefined);
    const db = parseEventDate(b.date ?? undefined);
    if (!da || !db) return 0;
    if (da.getTime() !== db.getTime()) return da.getTime() - db.getTime();
    return String(a.id ?? "").localeCompare(String(b.id ?? ""));
  });

  for (const event of sortedEvents) {
    if (event.status !== "completed" && event.status !== "live") continue;
    const sortedMatches = getSortedMatchesForEvent(event);
    for (let i = 0; i < sortedMatches.length; i++) {
      const match = sortedMatches[i];
      if (String(match.matchType || "").toLowerCase() === "promo") continue;
      if (match.status != null && match.status !== "completed") continue;
      const participated = slugSet.some((s) => didWrestlerParticipate(match, s, wrestlerMap));
      if (!participated) continue;
      list.push({ event, match, matchIndex: i });
    }
  }
  return list;
}

/** Newest-first items (last N overall). */
export function getLastMatchesForWrestler(
  events: TimelineEvent[],
  profileSlugs: string[],
  wrestlerMap: Record<string, WrestlerMapEntry>,
  limit = 5
): ChronologicalMatchItem[] {
  const list = buildChronologicalWrestlerMatchList(events, profileSlugs, wrestlerMap);
  if (list.length === 0) return [];
  const start = Math.max(0, list.length - limit);
  return list.slice(start).reverse();
}

/**
 * W/L/D from the profile wrestler's perspective, matching PWBS: `getMatchOutcome(match, slug, wrestlerMap)` where
 * `wrestlerMap` is id-keyed. When the URL slug differs from `wrestlers.id`, we alias it for lookup/outcome.
 */
export function getMatchOutcomeForProfile(
  match: TimelineMatch,
  wrestlerId: string,
  urlSlug: string,
  wrestlerName: string | null,
  idKeyedWrestlerMap: Record<string, WrestlerMapEntry>
): MatchOutcome {
  const map = enrichProfileWrestlerMap(idKeyedWrestlerMap, wrestlerId, urlSlug, wrestlerName);
  const id = String(wrestlerId ?? "").trim();
  const slug = String(urlSlug ?? "").trim();
  const tryOrder = getProfileParticipationSlugs(id, slug);
  for (const s of tryOrder) {
    if (didWrestlerParticipate(match, s, map)) {
      return getMatchOutcome(match, s, map);
    }
  }
  return "D";
}
