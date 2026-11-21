import { getPwbsReignGroupKey } from "@/lib/pwbsChampionshipSlug.js";
import { normalizeWrestlerName } from "@/lib/scoring/parsers/participantParser.js";
import { resolvePersonaToCanonical } from "@/lib/scoring/personaResolution.js";
import { wrestlerRosterFromBrand } from "@/lib/wrestlerRosterFromBrand";

/**
 * Global salary-cap prices, recomputed on the 1st (Pacific) for leagues created after that refresh.
 * Existing league snapshots are not rewritten.
 *
 * The price is the wrestler's body of work, not one match.
 * A title match is already inside the point total. One title match in someone else's story
 * does not raise the price when the rest of the year is short and low-scoring.
 *
 * Order:
 * 1. Inactive wrestlers are not priced.
 * 2. NXT roster starts at $5. The current NXT Champion and NXT Women's Champion are at least $10.
 * 3. Main roster starts at $10.
 * 4. This year, 10 or more matches and 90 or more points is $15. 10 or more matches and 150 or more points is $20.
 * 5. The last 90 days can raise a thin year when the run is real: 6 or more matches and 50 or more points is $15,
 *    and 6 or more matches and 80 or more points is $20.
 * 6. A short year after an injury can still reach $15 when the last 90 days are a main-event run:
 *    5 or more matches, at least 5 of them main events, and at least 6 points per match.
 * 7. Current world champions are $25. Current US and Intercontinental champions are at least $15.
 *    A tag reign or a single title match does not set a price by itself.
 */

/** Leagues created on or after this date copy `wrestlers.salary_cap_cost` at creation. Earlier leagues keep their seed or snapshot. */
export const SALARY_CAP_MONTHLY_PRICING_START = "2026-11-11";

export const SALARY_CAP_MAJOR_CHAMPION_COST = 25;
export const SALARY_CAP_MIDCARD_CHAMPION_COST = 15;
export const SALARY_CAP_NXT_CHAMPION_COST = 10;
/** NXT roster wrestlers who are not the men's or women's NXT champion and have not cleared a points tier. */
export const SALARY_CAP_DEFAULT_COST = 5;
/** Main-roster wrestlers whose year and last 90 days stay under the $15 line. */
export const SALARY_CAP_MAIN_ROSTER_DEFAULT_COST = 10;
export const SALARY_CAP_PRODUCTION_COST_20 = 20;
export const SALARY_CAP_PRODUCTION_COST_15 = 15;

export const SALARY_CAP_YEAR_MATCHES = 10;
export const SALARY_CAP_YEAR_POINTS_20 = 150;
export const SALARY_CAP_YEAR_POINTS_15 = 90;

export const SALARY_CAP_RECENT_DAYS = 90;
export const SALARY_CAP_RECENT_MATCHES = 6;
export const SALARY_CAP_RECENT_POINTS_20 = 80;
export const SALARY_CAP_RECENT_POINTS_15 = 50;

/** Last 90 days: enough main events, at a main-event scoring rate, to price a short injury year at $15. */
export const SALARY_CAP_MAIN_EVENT_RUN_MATCHES = 5;
export const SALARY_CAP_MAIN_EVENT_RUN_MAINS = 5;
export const SALARY_CAP_MAIN_EVENT_RUN_PPM = 6;
export const SALARY_CAP_MAIN_EVENT_RUN_COST = 15;

/** @deprecated Use SALARY_CAP_RECENT_DAYS. Kept so older imports still compile. */
export const SALARY_CAP_ACTIVITY_LOOKBACK_DAYS = SALARY_CAP_RECENT_DAYS;

const NXT_WORLD_TITLE_SLUGS = new Set(["nxt-championship", "nxt-womens-championship"]);

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
  | "inactive"
  | "nxt"
  | "nxt-champion"
  | "major-champion"
  | "midcard-champion"
  | "year-production"
  | "recent-production"
  | "main-event-run"
  | "default";

/** Matches and fantasy points (weekly shows, premium events, and match title points) in one window. */
export type SalaryCapWindowStat = {
  matches: number;
  points: number;
  /** Main-event matches inside this window. Used for a return that the year total has not caught up to. */
  mainEvents?: number;
};

export type SalaryCapWrestlerInput = {
  id: string;
  name?: string | null;
  brand?: string | null;
  status?: string | null;
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
  /** Null when the wrestler is inactive and should not be listed. */
  cost: number | null;
  reason: SalaryCapPriceReason;
};

export function addDaysYmd(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return ymd;
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function salaryCapYearStart(asOfYmd: string): string {
  return `${asOfYmd.slice(0, 4)}-01-01`;
}

export function salaryCapTitleTier(title: string | null | undefined): SalaryCapTitleTier | null {
  const slug = getPwbsReignGroupKey(title ?? "");
  if (!slug || slug.startsWith("nxt")) return null;
  if (MAJOR_TITLE_SLUGS.has(slug)) return "major";
  if (MIDCARD_TITLE_SLUGS.has(slug)) return "midcard";
  if (TAG_TITLE_SLUGS.has(slug) || slug.includes("tag")) return "tag";
  return null;
}

export function isNxtMensOrWomensChampionTitle(title: string | null | undefined): boolean {
  return NXT_WORLD_TITLE_SLUGS.has(getPwbsReignGroupKey(title ?? ""));
}

export function isInactiveSalaryCapStatus(status: string | null | undefined): boolean {
  return String(status ?? "").trim().toLowerCase() === "inactive";
}

/** Highest tier supported by one window. A short or low-scoring window returns null. */
export function salaryCapProductionCost(
  stat: SalaryCapWindowStat | null | undefined,
  window: "year" | "recent"
): number | null {
  if (!stat) return null;
  const matches = Number(stat.matches);
  const points = Number(stat.points);
  if (window === "year") {
    if (matches >= SALARY_CAP_YEAR_MATCHES && points >= SALARY_CAP_YEAR_POINTS_20) return SALARY_CAP_PRODUCTION_COST_20;
    if (matches >= SALARY_CAP_YEAR_MATCHES && points >= SALARY_CAP_YEAR_POINTS_15) return SALARY_CAP_PRODUCTION_COST_15;
    return null;
  }
  if (matches >= SALARY_CAP_RECENT_MATCHES && points >= SALARY_CAP_RECENT_POINTS_20) return SALARY_CAP_PRODUCTION_COST_20;
  if (matches >= SALARY_CAP_RECENT_MATCHES && points >= SALARY_CAP_RECENT_POINTS_15) return SALARY_CAP_PRODUCTION_COST_15;
  return null;
}

/**
 * $15 when a recent sample is mostly main events and scores at a main-event rate.
 * Appearing in one title match, or main-eventing while scoring like the undercard, does not qualify.
 */
export function salaryCapMainEventRunCost(stat: SalaryCapWindowStat | null | undefined): number | null {
  if (!stat) return null;
  const matches = Number(stat.matches);
  const points = Number(stat.points);
  const mainEvents = Number(stat.mainEvents ?? 0);
  if (!Number.isFinite(matches) || matches < SALARY_CAP_MAIN_EVENT_RUN_MATCHES) return null;
  if (mainEvents < SALARY_CAP_MAIN_EVENT_RUN_MAINS) return null;
  if (points / matches < SALARY_CAP_MAIN_EVENT_RUN_PPM) return null;
  return SALARY_CAP_MAIN_EVENT_RUN_COST;
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

/**
 * Price every wrestler as of `asOfYmd`. Year and recent stats are the body of work.
 * Current world and midcard reigns raise the floor. A title match does not.
 */
export function priceSalaryCapRoster(params: {
  asOfYmd: string;
  wrestlers: SalaryCapWrestlerInput[];
  reigns: SalaryCapReignInput[];
  yearByWrestlerId?: Record<string, SalaryCapWindowStat>;
  recentByWrestlerId?: Record<string, SalaryCapWindowStat>;
}): SalaryCapPrice[] {
  const asOf = params.asOfYmd.slice(0, 10);
  const yearByWrestlerId = params.yearByWrestlerId ?? {};
  const recentByWrestlerId = params.recentByWrestlerId ?? {};

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
  const nxtWorldChampion = new Set<string>();
  const rank: Record<SalaryCapTitleTier, number> = { tag: 1, midcard: 2, major: 3 };
  for (const reign of params.reigns) {
    const won = String(reign.won ?? "").slice(0, 10);
    const lost = reign.lost ? String(reign.lost).slice(0, 10) : "";
    if (!won || won > asOf) continue;
    if (lost && lost < asOf) continue;
    if (isNxtMensOrWomensChampionTitle(reign.title)) {
      for (const id of championIdsForReign(reign.champion, idBySlug, asOf)) nxtWorldChampion.add(id);
    }
    const tier = salaryCapTitleTier(reign.title);
    if (!tier) continue;
    for (const id of championIdsForReign(reign.champion, idBySlug, asOf)) {
      const prev = championTier.get(id);
      if (!prev || rank[tier] > rank[prev]) championTier.set(id, tier);
    }
  }

  return params.wrestlers
    .map((wrestler): SalaryCapPrice | null => {
      const wrestlerId = String(wrestler.id ?? "").trim();
      if (!wrestlerId) return null;
      if (isInactiveSalaryCapStatus(wrestler.status)) {
        return { wrestlerId, cost: null, reason: "inactive" as const };
      }

      const nxt = wrestlerRosterFromBrand(wrestler.brand) === "NXT";
      const yearCost = salaryCapProductionCost(yearByWrestlerId[wrestlerId], "year");
      const recentCost = salaryCapProductionCost(recentByWrestlerId[wrestlerId], "recent");
      let cost = nxt ? SALARY_CAP_DEFAULT_COST : SALARY_CAP_MAIN_ROSTER_DEFAULT_COST;
      let reason: SalaryCapPriceReason = nxt ? "nxt" : "default";

      const production = Math.max(yearCost ?? 0, recentCost ?? 0);
      if (production > cost) {
        cost = production;
        reason = (recentCost ?? 0) > (yearCost ?? 0) ? "recent-production" : "year-production";
      }

      const mainEventRun = salaryCapMainEventRunCost(recentByWrestlerId[wrestlerId]);
      if (mainEventRun != null && mainEventRun > cost) {
        cost = mainEventRun;
        reason = "main-event-run";
      }

      if (nxt && nxtWorldChampion.has(wrestlerId) && cost < SALARY_CAP_NXT_CHAMPION_COST) {
        cost = SALARY_CAP_NXT_CHAMPION_COST;
        reason = "nxt-champion";
      }

      const held = championTier.get(wrestlerId);
      if (held === "major" && cost < SALARY_CAP_MAJOR_CHAMPION_COST) {
        cost = SALARY_CAP_MAJOR_CHAMPION_COST;
        reason = "major-champion";
      } else if (held === "midcard" && cost < SALARY_CAP_MIDCARD_CHAMPION_COST) {
        cost = SALARY_CAP_MIDCARD_CHAMPION_COST;
        reason = "midcard-champion";
      }

      return { wrestlerId, cost, reason };
    })
    .filter((row): row is SalaryCapPrice => row != null);
}
