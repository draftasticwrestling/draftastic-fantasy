import { getPwbsReignGroupKey } from "@/lib/pwbsChampionshipSlug.js";
import { isNxtBrandEventType, isPLE, classifyEventType, EVENT_TYPES } from "@/lib/scoring/parsers/eventClassifier.js";
import { extractMatchParticipants, normalizeWrestlerName } from "@/lib/scoring/parsers/participantParser.js";
import { getMatchTitle, isMainEvent, isTitleMatch } from "@/lib/scoring/extractors/matches.js";
import { resolvePersonaToCanonical } from "@/lib/scoring/personaResolution.js";
import { wrestlerRosterFromBrand } from "@/lib/wrestlerRosterFromBrand";

/**
 * Global salary-cap prices, recomputed on the 1st (Pacific) for leagues created after that refresh.
 * Existing league snapshots are not rewritten.
 *
 * Order:
 * 1. NXT roster is always $5.
 * 2. Current champions: major $25, US/IC $15, tag $10. Highest title wins.
 * 3. Non-champions, looking back 90 days:
 *    - $20 for a major-title program: 2+ major title matches, or a major title reign that ended in the window.
 *    - $10 for a single major title match, or any US/IC title match.
 *    - $5 otherwise.
 * 4. Non-champions then get $5 activity bumps, capped at $20:
 *    - +$5 for 4+ Raw/SmackDown main events or 2+ main-roster PLEs in the past 90 days
 *    - another +$5 for 8+ Raw/SmackDown main events or 4+ main-roster PLEs in that window
 */

/** Leagues created on or after this date copy `wrestlers.salary_cap_cost` at creation. Earlier leagues keep their seed or snapshot. */
export const SALARY_CAP_MONTHLY_PRICING_START = "2026-11-11";

export const SALARY_CAP_MAJOR_CHAMPION_COST = 25;
export const SALARY_CAP_MIDCARD_CHAMPION_COST = 15;
export const SALARY_CAP_TAG_CHAMPION_COST = 10;
export const SALARY_CAP_MAJOR_TITLE_PROGRAM_COST = 20;
export const SALARY_CAP_MAJOR_TITLE_MATCH_COST = 10;
export const SALARY_CAP_MAJOR_TITLE_PROGRAM_MATCHES = 2;
export const SALARY_CAP_MIDCARD_TITLE_MATCH_COST = 10;
export const SALARY_CAP_DEFAULT_COST = 5;
export const SALARY_CAP_ACTIVITY_CAP = 20;

export const SALARY_CAP_TITLE_MATCH_LOOKBACK_DAYS = 90;
export const SALARY_CAP_ACTIVITY_LOOKBACK_DAYS = 90;

/** About one Raw/SmackDown main event every third week, or two premium shows. */
export const SALARY_CAP_MAIN_EVENT_BUMP_1 = 4;
export const SALARY_CAP_PLE_BUMP_1 = 2;
/** About every other week, or four premium shows. */
export const SALARY_CAP_MAIN_EVENT_BUMP_2 = 8;
export const SALARY_CAP_PLE_BUMP_2 = 4;

const MAJOR_TITLE_SLUGS = new Set([
  "wwe-championship",
  "wwe-womens-championship",
  "world-heavyweight-championship",
  "womens-world-championship",
]);

const MIDCARD_TITLE_SLUGS = new Set([
  "mens-ic-championship",
  "womens-ic-championship",
  "mens-us-championship",
  "womens-us-championship",
]);

const TAG_TITLE_SLUGS = new Set([
  "raw-tag-team-championship",
  "smackdown-tag-team-championship",
  "womens-tag-team-championship",
]);

export type SalaryCapTitleTier = "major" | "midcard" | "tag";

export type SalaryCapPriceReason =
  | "nxt"
  | "major-champion"
  | "midcard-champion"
  | "tag-champion"
  | "major-title-program"
  | "major-title-match"
  | "midcard-title-match"
  | "default";

export type SalaryCapWrestlerInput = {
  id: string;
  name?: string | null;
  brand?: string | null;
};

export type SalaryCapReignInput = {
  title: string;
  champion: string;
  won: string;
  lost?: string | null;
};

export type SalaryCapEventInput = {
  id?: string | null;
  name?: string | null;
  date?: string | null;
  matches?: unknown[] | null;
};

export type SalaryCapPrice = {
  wrestlerId: string;
  cost: number;
  reason: SalaryCapPriceReason;
  /** 0, 1, or 2. Champions and NXT do not receive bumps. */
  activityBumps: number;
  rawSmackDownMainEvents: number;
  pleShows: number;
};

export function addDaysYmd(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return ymd;
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function salaryCapTitleTier(title: string | null | undefined): SalaryCapTitleTier | null {
  const slug = getPwbsReignGroupKey(title ?? "");
  if (!slug || slug.startsWith("nxt")) return null;
  if (MAJOR_TITLE_SLUGS.has(slug)) return "major";
  if (MIDCARD_TITLE_SLUGS.has(slug)) return "midcard";
  if (TAG_TITLE_SLUGS.has(slug) || slug.includes("tag")) return "tag";
  return null;
}

function isPromoMatch(match: Record<string, unknown>): boolean {
  const type = String(match.matchType ?? match.match_type ?? "").toLowerCase();
  const stip = String(match.stipulation ?? "").toLowerCase();
  return type === "promo" || stip === "promo";
}

function lookupId(raw: string, idBySlug: Map<string, string>, eventDate: string): string | null {
  const slug = normalizeWrestlerName(raw);
  if (!slug) return null;
  const canonical = resolvePersonaToCanonical(slug, eventDate) || slug;
  return idBySlug.get(canonical) ?? idBySlug.get(slug) ?? null;
}

function championIdsForReign(champion: string, idBySlug: Map<string, string>, asOf: string): string[] {
  const whole = lookupId(champion, idBySlug, asOf);
  const parts = champion
    .split(/\s*(?:&| and )\s*/i)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length <= 1) return whole ? [whole] : [];
  const ids = parts
    .map((part) => lookupId(part, idBySlug, asOf))
    .filter((id): id is string => Boolean(id));
  if (ids.length > 0) return [...new Set(ids)];
  return whole ? [whole] : [];
}

function activityBumps(mainEvents: number, pleShows: number): number {
  let bumps = 0;
  if (mainEvents >= SALARY_CAP_MAIN_EVENT_BUMP_1 || pleShows >= SALARY_CAP_PLE_BUMP_1) bumps += 1;
  if (mainEvents >= SALARY_CAP_MAIN_EVENT_BUMP_2 || pleShows >= SALARY_CAP_PLE_BUMP_2) bumps += 1;
  return bumps;
}

/**
 * Price every wrestler as of `asOfYmd` (the refresh date, not included in the lookback windows).
 */
export function priceSalaryCapRoster(params: {
  asOfYmd: string;
  wrestlers: SalaryCapWrestlerInput[];
  reigns: SalaryCapReignInput[];
  events: SalaryCapEventInput[];
}): SalaryCapPrice[] {
  const asOf = params.asOfYmd.slice(0, 10);
  const titleSince = addDaysYmd(asOf, -SALARY_CAP_TITLE_MATCH_LOOKBACK_DAYS);
  const activitySince = addDaysYmd(asOf, -SALARY_CAP_ACTIVITY_LOOKBACK_DAYS);

  const idBySlug = new Map<string, string>();
  for (const wrestler of params.wrestlers) {
    const id = String(wrestler.id ?? "").trim();
    if (!id) continue;
    const idSlug = normalizeWrestlerName(id);
    if (idSlug) idBySlug.set(idSlug, id);
    const nameSlug = normalizeWrestlerName(wrestler.name ?? "");
    if (nameSlug) idBySlug.set(nameSlug, id);
  }

  const championTier = new Map<string, SalaryCapTitleTier>();
  const rank: Record<SalaryCapTitleTier, number> = { tag: 1, midcard: 2, major: 3 };
  for (const reign of params.reigns) {
    const won = String(reign.won ?? "").slice(0, 10);
    const lost = reign.lost ? String(reign.lost).slice(0, 10) : "";
    if (!won || won > asOf) continue;
    if (lost && lost < asOf) continue;
    const tier = salaryCapTitleTier(reign.title);
    if (!tier) continue;
    for (const id of championIdsForReign(reign.champion, idBySlug, asOf)) {
      const prev = championTier.get(id);
      if (!prev || rank[tier] > rank[prev]) championTier.set(id, tier);
    }
  }

  const majorTitleMatches = new Map<string, number>();
  const midcardTitleMatch = new Set<string>();
  const formerMajorChampion = new Set<string>();
  for (const reign of params.reigns) {
    const lost = reign.lost ? String(reign.lost).slice(0, 10) : "";
    if (!lost || lost < titleSince || lost >= asOf) continue;
    if (salaryCapTitleTier(reign.title) !== "major") continue;
    for (const id of championIdsForReign(reign.champion, idBySlug, asOf)) formerMajorChampion.add(id);
  }
  const mainEvents = new Map<string, number>();
  const pleShows = new Map<string, Set<string>>();

  for (const event of params.events) {
    const eventDate = String(event.date ?? "").slice(0, 10);
    if (!eventDate || eventDate < activitySince || eventDate >= asOf) continue;
    const matches = (Array.isArray(event.matches) ? event.matches : []).filter(
      (match): match is Record<string, unknown> => Boolean(match) && typeof match === "object"
    );
    const eventType = classifyEventType(String(event.name ?? ""), String(event.id ?? ""));
    const nxtShow = isNxtBrandEventType(eventType);
    const weeklyMainRoster =
      eventType === EVENT_TYPES.RAW || eventType === EVENT_TYPES.SMACKDOWN;
    const pleShow = isPLE(eventType) && !nxtShow;
    const eventKey = String(event.id ?? `${event.name ?? ""}-${eventDate}`);

    for (const match of matches) {
      if (isPromoMatch(match)) continue;
      const extracted = extractMatchParticipants(match) as { participantsForScoring?: string[] };
      const names = extracted.participantsForScoring ?? [];
      const ids = [
        ...new Set(
          names
            .map((name) => lookupId(name, idBySlug, eventDate))
            .filter((id): id is string => Boolean(id))
        ),
      ];
      if (ids.length === 0) continue;

      const inTitleWindow = eventDate >= titleSince;
      if (inTitleWindow && !nxtShow && isTitleMatch(match)) {
        const tier = salaryCapTitleTier(getMatchTitle(match));
        if (tier === "major") {
          for (const id of ids) majorTitleMatches.set(id, (majorTitleMatches.get(id) ?? 0) + 1);
        }
        if (tier === "midcard") ids.forEach((id) => midcardTitleMatch.add(id));
      }

      if (weeklyMainRoster && isMainEvent(match, matches)) {
        for (const id of ids) mainEvents.set(id, (mainEvents.get(id) ?? 0) + 1);
      }
      if (pleShow) {
        for (const id of ids) {
          const shows = pleShows.get(id) ?? new Set<string>();
          shows.add(eventKey);
          pleShows.set(id, shows);
        }
      }
    }
  }

  return params.wrestlers
    .map((wrestler) => {
      const wrestlerId = String(wrestler.id ?? "").trim();
      const rawMain = mainEvents.get(wrestlerId) ?? 0;
      const pleCount = pleShows.get(wrestlerId)?.size ?? 0;
      if (!wrestlerId) return null;
      if (wrestlerRosterFromBrand(wrestler.brand) === "NXT") {
        return {
          wrestlerId,
          cost: SALARY_CAP_DEFAULT_COST,
          reason: "nxt" as const,
          activityBumps: 0,
          rawSmackDownMainEvents: rawMain,
          pleShows: pleCount,
        };
      }

      const held = championTier.get(wrestlerId);
      if (held === "major" || held === "midcard" || held === "tag") {
        const cost =
          held === "major"
            ? SALARY_CAP_MAJOR_CHAMPION_COST
            : held === "midcard"
              ? SALARY_CAP_MIDCARD_CHAMPION_COST
              : SALARY_CAP_TAG_CHAMPION_COST;
        return {
          wrestlerId,
          cost,
          reason: `${held}-champion` as SalaryCapPriceReason,
          activityBumps: 0,
          rawSmackDownMainEvents: rawMain,
          pleShows: pleCount,
        };
      }

      const majorMatches = majorTitleMatches.get(wrestlerId) ?? 0;
      const majorProgram = majorMatches >= SALARY_CAP_MAJOR_TITLE_PROGRAM_MATCHES || formerMajorChampion.has(wrestlerId);
      const base = majorProgram
        ? SALARY_CAP_MAJOR_TITLE_PROGRAM_COST
        : majorMatches === 1
          ? SALARY_CAP_MAJOR_TITLE_MATCH_COST
          : midcardTitleMatch.has(wrestlerId)
            ? SALARY_CAP_MIDCARD_TITLE_MATCH_COST
            : SALARY_CAP_DEFAULT_COST;
      const reason: SalaryCapPriceReason = majorProgram
        ? "major-title-program"
        : majorMatches === 1
          ? "major-title-match"
          : midcardTitleMatch.has(wrestlerId)
            ? "midcard-title-match"
            : "default";
      const bumps = activityBumps(rawMain, pleCount);
      const cost = Math.min(SALARY_CAP_ACTIVITY_CAP, base + bumps * 5);
      return {
        wrestlerId,
        cost,
        reason,
        activityBumps: bumps,
        rawSmackDownMainEvents: rawMain,
        pleShows: pleCount,
      };
    })
    .filter((row): row is SalaryCapPrice => row != null);
}
