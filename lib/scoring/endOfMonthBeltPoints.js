import { normalizeWrestlerName, parseParticipants, parseWinnersAndLosers } from "./parsers/participantParser.js";
import { isTitleMatch } from "./extractors/matches.js";
import { resolvePersonaToCanonical } from "./personaResolution.js";
import {
  expandRawTagTheVisionIfSingleMemberListed,
  expandWomensTagNiaLashIfSingleMemberListed,
  expandWorldTagPriestTruthIfSingleMemberListed,
  getTagTeamMemberSlugs,
  isTagTeamTitle,
  parseTagTeamChampionToMemberSlugs,
} from "./tagTeamMembers.js";
import { wrestlerMatchesBeltMapKey } from "./beltSlugMatch.js";
import { getPwbsReignGroupKey, getPwbsDisplayTitleForSlug } from "../pwbsChampionshipSlug.js";
import {
  FIRST_END_OF_MONTH_POINTS_DATE,
  FIRST_WEEKLY_BELT_WEEK_END_SUNDAY,
  firstEligibleWeekEndSundayForLeagueStart,
  getCompletedWeekEndSundaysForBeltScoring,
} from "../beltWeeklyHold";

export { FIRST_END_OF_MONTH_POINTS_DATE, FIRST_WEEKLY_BELT_WEEK_END_SUNDAY, firstEligibleWeekEndSundayForLeagueStart };

/** Title changes before this date are ignored when inferring reigns. Use so we see e.g. Apr 2025 change (Cody → John Cena). */
export const REIGN_EFFECTIVE_START = "2024-04-01";

/**
 * Completed events on or after this date feed inferReignsFromEvents for monthly belt / reign merge.
 * Must include shows *before* a league starts so who held a title at each month-end inside the league is correct
 * (league-scoped event slices alone miss pre-season title changes that history/changes tables may not list fully).
 */
export const BELT_REIGN_INFERENCE_EVENTS_FROM = "2020-01-01";

/** Last calendar month-end before weekly PST title-hold scoring (weeks ending Sundays from Apr 26, 2026). */
export const LAST_CALENDAR_MONTH_END_BEFORE_WEEKLY_BELT = "2026-03-31";

/**
 * Last calendar day (UTC) of the month containing `startDate` (first month-end anchor from league start).
 * @param {string} startDate - YYYY-MM-DD
 * @returns {string} YYYY-MM-DD
 */
export function firstMonthEndOnOrAfter(startDate) {
  const d = new Date(String(startDate).slice(0, 10) + "T12:00:00.000Z");
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  return new Date(Date.UTC(y, m + 1, 0)).toISOString().slice(0, 10);
}

/**
 * First calendar month-end eligible for legacy (full-tier) title-hold points for a league.
 * @param {string} leagueStartYmd
 */
export function firstLegacyCalendarMonthEndEligibleForLeagueStart(leagueStartYmd) {
  const lastDayOfStartMonth = firstMonthEndOnOrAfter(leagueStartYmd);
  return lastDayOfStartMonth >= FIRST_END_OF_MONTH_POINTS_DATE
    ? lastDayOfStartMonth
    : FIRST_END_OF_MONTH_POINTS_DATE;
}

/** Last day of month (UTC) for the UTC year/month of cursor. @param {Date} cursor */
function getMonthEndUtc(cursor) {
  return new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0))
    .toISOString()
    .slice(0, 10);
}

/**
 * @param {string} firstMonthEnd - YYYY-MM-DD
 * @param {string} [lastMonthEnd] - inclusive cap
 * @param {number} [nowMs]
 */
function monthEndsSince(firstMonthEnd, lastMonthEnd, nowMs) {
  const start = new Date(firstMonthEnd + "T12:00:00.000Z");
  const now = new Date(nowMs);
  const firstOfThisMonthUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const defaultCutoff = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
  /** @type {string[]} */
  const out = [];
  let cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  while (cursor < firstOfThisMonthUtc) {
    const monthEnd = getMonthEndUtc(cursor);
    const inRange =
      monthEnd >= firstMonthEnd && (lastMonthEnd ? monthEnd <= lastMonthEnd : monthEnd < defaultCutoff);
    if (inRange) out.push(monthEnd);
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
  }
  return out;
}

/** Boxscore rows use date_won / date_lost; fantasy rows use won_date / lost_date. */
function reignWonYmd(reign) {
  return (reign.won_date ?? reign.start_date ?? reign.date_won)?.slice(0, 10) || "";
}

function reignLostYmd(reign) {
  const v = reign.lost_date ?? reign.end_date ?? reign.date_lost;
  return v != null && String(v).trim() !== "" ? String(v).slice(0, 10) : null;
}

/** Display / belt scoring label: use title columns or map Boxscore championship_id → PWBS name. */
function reignTitleLabel(reign) {
  const t = (reign.title ?? reign.title_name ?? "").trim();
  if (t) return t;
  const cid = reign.championship_id != null ? String(reign.championship_id).trim() : "";
  return cid ? getPwbsDisplayTitleForSlug(cid) || cid : "";
}

function sameChampions(current, winnerNames) {
  const curSet = new Set((current || []).map((c) => normalizeWrestlerName(String(c.champion))).filter(Boolean));
  const winSet = new Set(winnerNames.map((w) => normalizeWrestlerName(String(w))).filter(Boolean));
  if (curSet.size !== winSet.size) return false;
  for (const k of curSet) if (!winSet.has(k)) return false;
  return true;
}

/**
 * Infer championship reigns from event/match data (title changes). Used with mergeReigns when championship_history is incomplete.
 * Tracks one lineage per PWBS title key (getPwbsReignGroupKey) so "Undisputed WWE Championship" vs
 * minor string variants don’t create parallel fake timelines and bogus "title changes" on defenses.
 * Infers a change when winners differ from current holder(s) for that canonical belt.
 * @param {Array<{ date: string, matches?: Array<{ title?: string, titleOutcome?: string, result?: string, participants?: string }> }>} events
 * @returns {Array<{ champion: string, title: string, won_date: string, lost_date: string | null }>}
 */
export function inferReignsFromEvents(events) {
  if (!events?.length) return [];

  const sorted = [...events].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  /** @type {Record<string, { champion: string, title: string, won_date: string }[]>} keyed by PWBS title slug / group */
  const currentByTitle = {};
  /** @type {Array<{ champion: string, title: string, won_date: string, lost_date: string | null }>} */
  const reigns = [];

  for (const event of sorted) {
    const eventDate = (event.date || "").slice(0, 10);
    if (!eventDate) continue;
    if (eventDate < REIGN_EFFECTIVE_START) continue;

    const matches = event.matches || [];
    for (const match of matches) {
      if (!isTitleMatch(match)) continue;

      const title = (match.title || "").trim();
      if (!title) continue;

      const groupKey = getPwbsReignGroupKey(title) || title.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
      const canonicalTitle = getPwbsDisplayTitleForSlug(groupKey) || title;

      const { winners } = parseWinnersAndLosers(match.result || "", match.participants || "");
      let winnerNames = winners.filter(Boolean);
      if (winnerNames.length === 0) continue;
      const participants = parseParticipants(match.participants || "");
      const teamToMembers = {};
      for (const p of participants) {
        if (p.type === "team" && p.members?.length) {
          teamToMembers[p.name] = p.members;
        }
      }
      const expanded = [];
      for (const w of winnerNames) {
        if (teamToMembers[w]) {
          expanded.push(...teamToMembers[w]);
        } else {
          expanded.push(w);
        }
      }
      winnerNames = expanded;

      if (currentByTitle[groupKey] && sameChampions(currentByTitle[groupKey], winnerNames)) continue;

      if (currentByTitle[groupKey]) {
        for (const prev of currentByTitle[groupKey]) {
          reigns.push({
            champion: prev.champion,
            title: prev.title,
            won_date: prev.won_date,
            lost_date: eventDate,
          });
        }
      }

      currentByTitle[groupKey] = winnerNames.map((champion) => ({
        champion,
        title: canonicalTitle,
        won_date: eventDate,
      }));
    }
  }

  for (const key of Object.keys(currentByTitle)) {
    for (const r of currentByTitle[key]) {
      reigns.push({
        champion: r.champion,
        title: r.title,
        won_date: r.won_date,
        lost_date: null,
      });
    }
  }

  return reigns;
}

/**
 * Normalize a reign to a key (slug, title, won_date) for deduplication.
 * @param {Object} r - reign with champion_slug, champion_id, champion, champion_name, title, title_name, won_date, start_date
 * @returns {[string, string, string]|null}
 */
function reignKey(r) {
  const name = r.champion ?? r.champion_name ?? "";
  const slug =
    r.champion_slug ??
    r.champion_id ??
    r.champion ??
    (name ? normalizeWrestlerName(String(name)) : null);
  if (!slug) return null;
  const canonical = normalizeWrestlerName(String(slug)) || slug;
  const cid = r.championship_id != null ? String(r.championship_id).trim() : "";
  const titleKey = cid || (r.title ?? r.title_name ?? "").trim() || "Championship";
  const won = (r.won_date ?? r.start_date ?? r.date_won)?.slice(0, 10);
  if (!won) return null;
  return [canonical, titleKey, won];
}

/**
 * Merge table reigns with event-inferred reigns so we don't miss reigns that exist in events but not in championship_history.
 * Dedupes by (champion slug, title, won_date); table reigns take precedence when the same reign exists in both.
 * @param {Array} tableReigns - from championship_history
 * @param {Array<{ champion: string, title: string, won_date: string, lost_date: string | null }>} inferredReigns - from inferReignsFromEvents
 * @returns {Array} combined reigns (table shape), deduped
 */
function tableCoversInferredTitleSlugs(tableReigns) {
  const s = new Set();
  for (const r of tableReigns ?? []) {
    const cid = r.championship_id != null ? String(r.championship_id).trim() : "";
    if (cid) s.add(cid);
    const t = (r.title ?? r.title_name ?? "").trim();
    if (t) {
      const g = getPwbsReignGroupKey(t);
      if (g) s.add(g);
    }
  }
  return s;
}

export function mergeReigns(tableReigns, inferredReigns) {
  const coveredSlugs = tableCoversInferredTitleSlugs(tableReigns);
  const byKey = /** @type {Record<string, object>} */ ({});
  for (const r of tableReigns ?? []) {
    const k = reignKey(r);
    if (k) byKey[JSON.stringify(k)] = r;
  }
  for (const r of inferredReigns ?? []) {
    const inferredG = getPwbsReignGroupKey((r.title || "").trim());
    if (inferredG && coveredSlugs.has(inferredG)) continue;
    const k = reignKey(r);
    if (!k || byKey[JSON.stringify(k)]) continue;
    byKey[JSON.stringify(k)] = {
      champion: r.champion,
      champion_name: r.champion,
      title: r.title,
      title_name: r.title,
      won_date: r.won_date,
      start_date: r.won_date,
      lost_date: r.lost_date ?? undefined,
      end_date: r.lost_date ?? undefined,
    };
  }
  return closeReignsFromSuccessors(Object.values(byKey));
}

/**
 * For each title, set lost_date on any reign when a later reign exists (same title, later won_date).
 * Groups by PWBS slug (see lib/pwbsChampionshipSlug.js) so e.g. "WWE Championship" and "Undisputed WWE Championship"
 * share one timeline, and men's vs women's IC/US stay separate.
 * @param {Array<{ title?: string, title_name?: string, won_date?: string, start_date?: string, lost_date?: string | null, end_date?: string | null }>} reigns
 * @returns {Array} same reigns, mutated lost_date/end_date where needed
 */
export function closeReignsFromSuccessors(reigns) {
  const byTitle = /** @type {Record<string, typeof reigns>} */ ({});
  for (const r of reigns) {
    const raw = (r.title ?? r.title_name ?? "").trim() || "Championship";
    const cid = r.championship_id != null ? String(r.championship_id).trim() : "";
    const t = cid || getPwbsReignGroupKey(raw) || raw;
    if (!byTitle[t]) byTitle[t] = [];
    byTitle[t].push(r);
  }
  for (const title of Object.keys(byTitle)) {
    const list = byTitle[title].sort(
      (a, b) =>
        (a.won_date || a.start_date || a.date_won || "").localeCompare(
          b.won_date || b.start_date || b.date_won || ""
        )
    );
    for (let i = 0; i < list.length - 1; i++) {
      const curr = list[i];
      if (curr.championship_id != null && String(curr.championship_id).trim() !== "") continue;
      const nextWon = (list[i + 1].won_date ?? list[i + 1].start_date ?? list[i + 1].date_won ?? "").slice(
        0,
        10
      );
      if (!nextWon) continue;
      const currLost = (curr.lost_date ?? curr.end_date ?? curr.date_lost) ?? null;
      if (currLost == null || currLost > nextWon) {
        curr.lost_date = nextWon;
        curr.end_date = nextWon;
      }
    }
  }
  return reigns;
}

/**
 * Sum monthly belt points in bySlug for this wrestler. Adds every map entry whose key matches id / display name / aliases
 * (same rules as faction ledger). Important when one wrestler has points under multiple keys (e.g. tag + singles aliases).
 *
 * @param {Record<string, number>} bySlug - from computeEndOfMonthBeltPoints* or computeEndOfMonthBeltPoints
 * @param {string} wrestlerId - wrestlers.id
 * @param {string} [displayNameOrNormalizedName] - wrestlers.name (any form) or normalizeWrestlerName(name)
 * @param {string} [refDateYmd] - YYYY-MM-DD for persona rules (month-end for stint scoring; default today UTC)
 * @param {string[]} [additionalWrestlerIds] - e.g. profile URL slug when different from wrestlers.id (counted once per map key)
 * @returns {number}
 */
export function getMonthlyBeltForWrestler(
  bySlug,
  wrestlerId,
  displayNameOrNormalizedName,
  refDateYmd,
  additionalWrestlerIds
) {
  if (!bySlug || typeof bySlug !== "object") return 0;
  const date =
    refDateYmd && typeof refDateYmd === "string" ? refDateYmd.slice(0, 10) : new Date().toISOString().slice(0, 10);
  const display =
    displayNameOrNormalizedName != null && String(displayNameOrNormalizedName).trim() !== ""
      ? String(displayNameOrNormalizedName)
      : undefined;
  const extraIds = Array.isArray(additionalWrestlerIds) ? additionalWrestlerIds.filter(Boolean) : [];
  const ids = [wrestlerId, ...extraIds].filter(Boolean);
  let sum = 0;
  for (const [k, v] of Object.entries(bySlug)) {
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0) continue;
    let hit = false;
    for (const id of ids) {
      if (wrestlerMatchesBeltMapKey(id, display, k, date)) {
        hit = true;
        break;
      }
    }
    if (hit) sum += n;
  }
  return sum;
}

/** Canonical key for bySlug maps so "Dominik Mysterio" and "dominik-mysterio" match. */
function canonicalSlug(s) {
  if (!s || typeof s !== "string") return "";
  // Underscores must become hyphens before stripping; else "the_vision" → "thevision" and tag maps miss "the-vision".
  const hyphenated = s.replace(/_/g, "-");
  return normalizeWrestlerName(hyphenated) || hyphenated.toLowerCase().trim();
}

/**
 * Add end-of-month title points for one reign row into bySlug.
 * Tag titles credit each known member (same idea as getCurrentChampionsBySlug).
 * Underscore champion_slug also credits a hyphen alias when it differs from key (Boxscore vs wrestlers.id).
 * @param {Record<string, number>} bySlug
 * @param {{ key: string, slug: string, rawSlug: string, championName: string, titleName: string, points: number }} row
 */
function addMonthlyBeltPointsForReignRow(bySlug, row) {
  const { key, slug, rawSlug, championName, titleName, points } = row;
  if (!points || points <= 0) return;

  const bump = (k) => {
    const ck = canonicalSlug(k);
    if (!ck) return;
    bySlug[ck] = (bySlug[ck] ?? 0) + points;
  };

  const title = (titleName ?? "").trim();
  const rawStr = String(rawSlug ?? "");
  const nameStr = String(championName ?? "");

  let creditedMembers = false;
  if (isTagTeamTitle(title)) {
    const members =
      getTagTeamMemberSlugs(key) ??
      getTagTeamMemberSlugs(slug) ??
      getTagTeamMemberSlugs(canonicalSlug(rawStr)) ??
      parseTagTeamChampionToMemberSlugs(nameStr) ??
      parseTagTeamChampionToMemberSlugs(rawStr) ??
      expandRawTagTheVisionIfSingleMemberListed(title, key, slug, rawStr) ??
      expandWorldTagPriestTruthIfSingleMemberListed(title, key, slug, rawStr) ??
      expandWomensTagNiaLashIfSingleMemberListed(title, key, slug, rawStr);
    if (members?.length) {
      creditedMembers = true;
      for (const m of members) bump(m);
    }
  }

  if (!creditedMembers) {
    bump(key);
    if (rawStr.includes("_")) {
      const hk = canonicalSlug(rawStr.replace(/_/g, "-"));
      const kNorm = canonicalSlug(key);
      if (hk && hk !== kNorm) bump(hk);
    }
  }
}

/**
 * Title tier scale (12 / 8 / 4); weekly hold scoring credits one quarter of these per week (3 / 2 / 1).
 * Tag Team = 4; Men's & Women's IC & US = 8; top singles (Undisputed WWE, WWE Women's, World Heavyweight, Women's World) = 12.
 * Order matters: more specific patterns first (e.g. women's US before men's US).
 */
const TITLE_POINTS = [
  // NXT title monthly points (RTSS optional add-on)
  { pattern: /nxt\s+women'?s?\s+championship/i, points: 3 },
  { pattern: /\bnxt\s+championship\b/i, points: 3 },
  { pattern: /nxt\s+women'?s?\s+north\s+american/i, points: 2 },
  { pattern: /nxt\s+north\s+american/i, points: 2 },
  { pattern: /nxt\s+women'?s?\s+speed|nxt\s+men'?s?\s+speed/i, points: 1 },
  { pattern: /nxt\s+tag/i, points: 1 },

  { pattern: /women'?s?\s+tag/i, points: 4 },
  { pattern: /world\s+tag/i, points: 4 },
  { pattern: /tag\s+team/i, points: 4 },
  { pattern: /women'?s?\s+intercontinental/i, points: 8 },
  { pattern: /women'?s?\s+ic\b/i, points: 8 },
  { pattern: /intercontinental|\bic\b/i, points: 8 },
  {
    pattern: /women'?s?\s+united\s+states|women'?s?\s+u\.?s\.?\s+championship|\bwomen'?s?\s+u\.?s\.?\b/i,
    points: 8,
  },
  { pattern: /united\s+states|\b(us|u\.s\.)\s+championship|\b(us|u\.s\.)\s+champion/i, points: 8 },
  { pattern: /\bwwe\s+women'?s?\s+championship\b/i, points: 12 },
  { pattern: /women'?s?\s+world|women'?s?\s+world\s+championship/i, points: 12 },
  { pattern: /undisputed\s+wwe|wwe\s+undisputed/i, points: 12 },
  { pattern: /world\s+heavyweight|heavyweight\s+championship/i, points: 12 },
  { pattern: /wwe\s+championship/i, points: 12 },
  { pattern: /world\s+champion/i, points: 12 },
];

const DEFAULT_TITLE_POINTS = 5;

/**
 * Tier points for a title (12 / 8 / 4 / default). Weekly hold scoring uses one quarter per week (3 / 2 / 1).
 * @param {string} titleName - e.g. "Undisputed WWE Championship", "Raw Tag Team"
 * @returns {number}
 */
export function getBeltPointsForTitle(titleName) {
  if (!titleName || typeof titleName !== "string") return DEFAULT_TITLE_POINTS;
  const t = titleName.trim().toLowerCase();
  for (const { pattern, points } of TITLE_POINTS) {
    if (pattern.test(t)) return points;
  }
  return DEFAULT_TITLE_POINTS;
}

/**
 * Fantasy points credited each week (Mon–Sun) for holding the title, locked end of day Sunday PST.
 * 12-point tier → 3/week, 8 → 2, 4 → 1; default tier uses round(monthly/4).
 * @param {string} titleName
 * @returns {number}
 */
export function getWeeklyHoldPointsForTitle(titleName) {
  const p = getBeltPointsForTitle(titleName);
  return Math.max(0, p / 4);
}

/**
 * Completed calendar month-ends (UTC) for legacy full-tier title-hold scoring.
 * @param {string} firstMonthEnd - YYYY-MM-DD
 * @param {string} [lastMonthEnd] - inclusive cap
 * @param {number} [nowMs]
 */
export function getCompletedMonthEndsForBeltScoring(firstMonthEnd, lastMonthEnd, nowMs = Date.now()) {
  return monthEndsSince(firstMonthEnd, lastMonthEnd, nowMs);
}

/**
 * Sum weekly PST title-hold points (Road to SummerSlam and other leagues using weekly mode).
 * @param {Array<{ champion_slug?: string | null, champion_id?: string | null, champion?: string | null, champion_name?: string | null, title?: string | null, title_name?: string | null, won_date?: string | null, start_date?: string | null, lost_date?: string | null, end_date?: string | null }>} reigns
 * @param {string} firstWeekEndSunday
 * @param {string} [lastWeekEndSundayCap]
 * @param {number} [nowMs]
 */
export function computeWeeklyBeltHoldPointsAccumulated(reigns, firstWeekEndSunday, lastWeekEndSundayCap, nowMs = Date.now()) {
  const bySlug = /** @type {Record<string, number>} */ ({});

  if (!reigns?.length || !firstWeekEndSunday) return bySlug;

  const weekEndDates = getCompletedWeekEndSundaysForBeltScoring(
    firstWeekEndSunday,
    lastWeekEndSundayCap,
    nowMs
  );

  for (const reign of reigns) {
    const championName = reign.champion ?? reign.champion_name ?? "";
    const rawSlug =
      reign.champion_slug ??
      reign.champion_id ??
      reign.champion ??
      (championName ? normalizeWrestlerName(championName) : null);
    if (!rawSlug) continue;

    let won = reignWonYmd(reign);
    const lost = reignLostYmd(reign);
    if (!won) continue;
    if (won < REIGN_EFFECTIVE_START) won = REIGN_EFFECTIVE_START;

    const slug = resolvePersonaToCanonical(rawSlug, won) ?? rawSlug;
    const key = canonicalSlug(slug);

    const titleName = reignTitleLabel(reign);
    const points = getWeeklyHoldPointsForTitle(titleName);

    for (const weekEnd of weekEndDates) {
      if (weekEnd < REIGN_EFFECTIVE_START) continue;
      if (won <= weekEnd && (lost == null || lost > weekEnd)) {
        addMonthlyBeltPointsForReignRow(bySlug, {
          key,
          slug,
          rawSlug,
          championName,
          titleName,
          points,
        });
      }
    }
  }

  return bySlug;
}

/**
 * Weekly PST title-hold points for one lock date (who held at end of that PT civil day).
 * @param {Array<{ champion_slug?, champion_id?, champion?, champion_name?, title?, title_name?, won_date?, start_date?, lost_date?, end_date? }>} reigns
 * @param {string} lockYmd - Sunday end-of-week, or last PLE date in the week when a PLE airs that week.
 * @param {string} firstEligibleWeekEndSunday
 * @param {string} [weekEndSundayForEligibility] - that week’s Sunday (Mon–Sun week). Defaults to `lockYmd` for legacy callers.
 */
export function computeWeeklyBeltHoldPointsForWeekEndSunday(
  reigns,
  lockYmd,
  firstEligibleWeekEndSunday,
  weekEndSundayForEligibility
) {
  const bySlug = /** @type {Record<string, number>} */ ({});

  const weekEl = weekEndSundayForEligibility ?? lockYmd;
  if (!reigns?.length || !lockYmd || !firstEligibleWeekEndSunday) return bySlug;
  if (weekEl < firstEligibleWeekEndSunday || lockYmd < REIGN_EFFECTIVE_START) return bySlug;

  for (const reign of reigns) {
    const championName = reign.champion ?? reign.champion_name ?? "";
    const rawSlug =
      reign.champion_slug ??
      reign.champion_id ??
      reign.champion ??
      (championName ? normalizeWrestlerName(championName) : null);
    if (!rawSlug) continue;

    let won = reignWonYmd(reign);
    const lost = reignLostYmd(reign);
    if (!won) continue;
    if (won < REIGN_EFFECTIVE_START) won = REIGN_EFFECTIVE_START;

    if (won > lockYmd || (lost != null && lost <= lockYmd)) continue;

    const slug = resolvePersonaToCanonical(rawSlug, won) ?? rawSlug;
    const key = canonicalSlug(slug);
    const titleName = reignTitleLabel(reign);
    const points = getWeeklyHoldPointsForTitle(titleName);
    addMonthlyBeltPointsForReignRow(bySlug, {
      key,
      slug,
      rawSlug,
      championName,
      titleName,
      points,
    });
  }

  return bySlug;
}

/**
 * Legacy calendar month-end title-hold points (full 12 / 8 / 4 per month-end).
 * @param {Array<{ champion_slug?: string | null, champion_id?: string | null, champion?: string | null, champion_name?: string | null, title?: string | null, title_name?: string | null, won_date?: string | null, start_date?: string | null, lost_date?: string | null, end_date?: string | null }>} reigns
 * @param {string} firstMonthEnd - YYYY-MM-DD
 * @param {string} [lastMonthEnd] - inclusive cap
 * @param {number} [nowMs]
 */
export function computeEndOfMonthBeltPoints(reigns, firstMonthEnd, lastMonthEnd, nowMs = Date.now()) {
  const bySlug = /** @type {Record<string, number>} */ ({});

  if (!reigns?.length || !firstMonthEnd) return bySlug;

  const monthEndDates = monthEndsSince(firstMonthEnd, lastMonthEnd, nowMs);

  for (const reign of reigns) {
    const championName = reign.champion ?? reign.champion_name ?? "";
    const rawSlug =
      reign.champion_slug ??
      reign.champion_id ??
      reign.champion ??
      (championName ? normalizeWrestlerName(championName) : null);
    if (!rawSlug) continue;

    let won = reignWonYmd(reign);
    const lost = reignLostYmd(reign);
    if (!won) continue;
    if (won < REIGN_EFFECTIVE_START) won = REIGN_EFFECTIVE_START;

    const slug = resolvePersonaToCanonical(rawSlug, won) ?? rawSlug;
    const key = canonicalSlug(slug);

    const titleName = reignTitleLabel(reign);
    const points = getBeltPointsForTitle(titleName);

    for (const monthEnd of monthEndDates) {
      if (monthEnd < REIGN_EFFECTIVE_START) continue;
      if (won <= monthEnd && (lost == null || lost > monthEnd)) {
        addMonthlyBeltPointsForReignRow(bySlug, {
          key,
          slug,
          rawSlug,
          championName,
          titleName,
          points,
        });
      }
    }
  }

  return bySlug;
}

/**
 * Legacy full-tier belt points for a single calendar month-end.
 * @param {Array<{ champion_slug?, champion_id?, champion?, champion_name?, title?, title_name?, won_date?, start_date?, lost_date?, end_date? }>} reigns
 * @param {string} monthEndDate - last day of month YYYY-MM-DD
 * @param {string} firstMonthEnd - no points if monthEndDate < firstMonthEnd
 */
export function computeEndOfMonthBeltPointsForSingleMonth(reigns, monthEndDate, firstMonthEnd) {
  const bySlug = /** @type {Record<string, number>} */ ({});

  if (!reigns?.length || !monthEndDate || !firstMonthEnd) return bySlug;
  if (monthEndDate < firstMonthEnd || monthEndDate < REIGN_EFFECTIVE_START) return bySlug;

  for (const reign of reigns) {
    const championName = reign.champion ?? reign.champion_name ?? "";
    const rawSlug =
      reign.champion_slug ??
      reign.champion_id ??
      reign.champion ??
      (championName ? normalizeWrestlerName(championName) : null);
    if (!rawSlug) continue;

    let won = reignWonYmd(reign);
    const lost = reignLostYmd(reign);
    if (!won) continue;
    if (won < REIGN_EFFECTIVE_START) won = REIGN_EFFECTIVE_START;

    if (won > monthEndDate || (lost != null && lost <= monthEndDate)) continue;

    const slug = resolvePersonaToCanonical(rawSlug, won) ?? rawSlug;
    const key = canonicalSlug(slug);
    const titleName = reignTitleLabel(reign);
    const points = getBeltPointsForTitle(titleName);
    addMonthlyBeltPointsForReignRow(bySlug, {
      key,
      slug,
      rawSlug,
      championName,
      titleName,
      points,
    });
  }

  return bySlug;
}

/**
 * Get title reigns for a single wrestler (for profile display): which titles they held and which legacy month-ends scored.
 * @param {Array<{ champion_slug?: string | null, champion_id?: string | null, champion?: string | null, champion_name?: string | null, title?: string | null, title_name?: string | null, won_date?: string | null, start_date?: string | null, lost_date?: string | null, end_date?: string | null }>} reigns
 * @param {string} firstMonthEnd - first eligible calendar month-end YYYY-MM-DD
 * @param {string} wrestlerSlug - wrestlers.id to match
 * @returns {Array<{ title: string, monthEnds: string[] }>}
 */
export function getTitleReignsForWrestler(reigns, firstMonthEnd, wrestlerSlug) {
  if (!reigns?.length || !firstMonthEnd || !wrestlerSlug) return [];

  const monthEndDates = monthEndsSince(firstMonthEnd, undefined, Date.now());
  const out = /** @type {Array<{ title: string, monthEnds: string[] }>} */ ([]);

  for (const reign of reigns) {
    const championName = reign.champion ?? reign.champion_name ?? "";
    const rawSlug =
      reign.champion_slug ??
      reign.champion_id ??
      reign.champion ??
      (championName ? normalizeWrestlerName(championName) : null);
    if (!rawSlug) continue;
    let won = reignWonYmd(reign);
    const slug = resolvePersonaToCanonical(rawSlug, won) ?? rawSlug;
    if (canonicalSlug(slug) !== canonicalSlug(wrestlerSlug)) continue;

    const lost = reignLostYmd(reign);
    if (!won) continue;
    if (won < REIGN_EFFECTIVE_START) won = REIGN_EFFECTIVE_START;

    const titleName = reignTitleLabel(reign).trim() || "Championship";
    const monthEnds = monthEndDates.filter(
      (monthEnd) => monthEnd >= REIGN_EFFECTIVE_START && won <= monthEnd && (lost == null || lost > monthEnd)
    );
    if (monthEnds.length > 0) {
      out.push({ title: titleName, monthEnds });
    }
  }

  return out;
}

/**
 * Legacy calendar month-ends where this reign earns fantasy title-hold points for the profile wrestler.
 * @param {object} reign
 * @param {string} firstMonthEnd - first eligible calendar month-end
 * @param {string} wrestlerId
 * @param {string} [urlSlug]
 * @param {string} [lastMonthEndCap] - optional inclusive month-end cap
 */
export function getFantasyBeltMonthEndsForReign(reign, firstMonthEnd, wrestlerId, urlSlug, lastMonthEndCap) {
  if (!reign || !firstMonthEnd || !wrestlerId) return [];

  const viewerKeys = /** @type {string[]} */ ([]);
  for (const s of [wrestlerId, urlSlug || ""]) {
    const k = canonicalSlug(String(s).trim());
    if (k) viewerKeys.push(k);
  }
  const viewerSet = new Set(viewerKeys);
  if (viewerSet.size === 0) return [];

  const championName = reign.champion ?? reign.champion_name ?? "";
  const rawSlug =
    reign.champion_slug ??
    reign.champion_id ??
    reign.champion ??
    (championName ? normalizeWrestlerName(championName) : null);
  if (!rawSlug) return [];

  let won = reignWonYmd(reign);
  if (!won) return [];
  if (won < REIGN_EFFECTIVE_START) won = REIGN_EFFECTIVE_START;
  const lost = reignLostYmd(reign);

  const resolvedChampSlug = resolvePersonaToCanonical(rawSlug, won) ?? rawSlug;
  const champKey = canonicalSlug(resolvedChampSlug);
  const titleName = reignTitleLabel(reign);

  let viewerIsHolder = viewerSet.has(champKey);
  if (!viewerIsHolder && isTagTeamTitle(titleName)) {
    const fromMap = getTagTeamMemberSlugs(champKey);
    const fromParse = parseTagTeamChampionToMemberSlugs(String(championName || rawSlug || ""));
    const members = fromMap?.length ? fromMap : fromParse;
    if (members?.length) {
      const memberKeys = new Set(members.map((m) => canonicalSlug(m)));
      for (const v of viewerSet) {
        if (memberKeys.has(v)) {
          viewerIsHolder = true;
          break;
        }
      }
    }
  }

  if (!viewerIsHolder) return [];

  const monthEndDates = monthEndsSince(firstMonthEnd, lastMonthEndCap, Date.now());
  return monthEndDates.filter(
    (monthEnd) => monthEnd >= REIGN_EFFECTIVE_START && won <= monthEnd && (lost == null || lost > monthEnd)
  );
}

/**
 * Week-ending Sundays (weekly PST title-hold) where this reign earns fantasy belt credit.
 * @param {object} reign
 * @param {string} firstWeekEndSunday
 * @param {string} wrestlerId
 * @param {string} [urlSlug]
 * @param {string} [lastWeekEndSundayCap] - any YYYY-MM-DD; capped to last Sunday on or before
 */
export function getFantasyBeltWeekEndsForReign(reign, firstWeekEndSunday, wrestlerId, urlSlug, lastWeekEndSundayCap) {
  if (!reign || !firstWeekEndSunday || !wrestlerId) return [];

  const viewerKeys = /** @type {string[]} */ ([]);
  for (const s of [wrestlerId, urlSlug || ""]) {
    const k = canonicalSlug(String(s).trim());
    if (k) viewerKeys.push(k);
  }
  const viewerSet = new Set(viewerKeys);
  if (viewerSet.size === 0) return [];

  const championName = reign.champion ?? reign.champion_name ?? "";
  const rawSlug =
    reign.champion_slug ??
    reign.champion_id ??
    reign.champion ??
    (championName ? normalizeWrestlerName(championName) : null);
  if (!rawSlug) return [];

  let won = reignWonYmd(reign);
  if (!won) return [];
  if (won < REIGN_EFFECTIVE_START) won = REIGN_EFFECTIVE_START;
  const lost = reignLostYmd(reign);

  const resolvedChampSlug = resolvePersonaToCanonical(rawSlug, won) ?? rawSlug;
  const champKey = canonicalSlug(resolvedChampSlug);
  const titleName = reignTitleLabel(reign);

  let viewerIsHolder = viewerSet.has(champKey);
  if (!viewerIsHolder && isTagTeamTitle(titleName)) {
    const fromMap = getTagTeamMemberSlugs(champKey);
    const fromParse = parseTagTeamChampionToMemberSlugs(String(championName || rawSlug || ""));
    const members = fromMap?.length ? fromMap : fromParse;
    if (members?.length) {
      const memberKeys = new Set(members.map((m) => canonicalSlug(m)));
      for (const v of viewerSet) {
        if (memberKeys.has(v)) {
          viewerIsHolder = true;
          break;
        }
      }
    }
  }

  if (!viewerIsHolder) return [];

  const weekEndDates = getCompletedWeekEndSundaysForBeltScoring(
    firstWeekEndSunday,
    lastWeekEndSundayCap,
    Date.now()
  );
  return weekEndDates.filter(
    (weekEnd) => weekEnd >= REIGN_EFFECTIVE_START && won <= weekEnd && (lost == null || lost > weekEnd)
  );
}

/**
 * Profile display: legacy month-ends through Mar 2026 plus weekly week-ends from Apr 26, 2026 (deduped, sorted).
 */
export function getFantasyBeltScoringDatesForReignPublicDisplay(reign, wrestlerId, urlSlug) {
  const monthPart = getFantasyBeltMonthEndsForReign(
    reign,
    FIRST_END_OF_MONTH_POINTS_DATE,
    wrestlerId,
    urlSlug,
    LAST_CALENDAR_MONTH_END_BEFORE_WEEKLY_BELT
  );
  const weekPart = getFantasyBeltWeekEndsForReign(
    reign,
    FIRST_WEEKLY_BELT_WEEK_END_SUNDAY,
    wrestlerId,
    urlSlug,
    undefined
  );
  const set = new Set([...monthPart, ...weekPart]);
  return [...set].sort((a, b) => a.localeCompare(b));
}

/**
 * Current title holders: wrestler slug -> list of title names they currently hold.
 * A reign is "current" if lost_date/end_date is null or in the future.
 * @param {Array<{ champion_slug?, champion_id?, champion?, champion_name?, title?, title_name?, won_date?, start_date?, lost_date?, end_date? }>} reigns
 * @returns {Record<string, string[]>} slug -> title names (e.g. { "cody-rhodes": ["WWE Championship"] })
 */
export function getCurrentChampionsBySlug(reigns) {
  const today = new Date().toISOString().slice(0, 10);
  const bySlug = /** @type {Record<string, string[]>} */ ({});

  if (!reigns?.length) return bySlug;

  for (const reign of reigns) {
    const lost = reignLostYmd(reign);
    if (lost != null && lost <= today) continue;

    const championName = reign.champion ?? reign.champion_name ?? "";
    const rawSlug =
      reign.champion_slug ??
      reign.champion_id ??
      reign.champion ??
      (championName ? normalizeWrestlerName(championName) : null);
    if (!rawSlug) continue;

    const won = reignWonYmd(reign) ?? "";
    const slug = resolvePersonaToCanonical(rawSlug, won) ?? rawSlug;
    const key = canonicalSlug(slug);
    const titleName = reignTitleLabel(reign).trim() || "Championship";
    if (!bySlug[key]) bySlug[key] = [];
    if (!bySlug[key].includes(titleName)) bySlug[key].push(titleName);
    const rawStr = String(rawSlug || "");
    if (rawStr.includes("_")) {
      const hyphenKey = canonicalSlug(rawStr.replace(/_/g, "-"));
      if (hyphenKey && hyphenKey !== key) {
        if (!bySlug[hyphenKey]) bySlug[hyphenKey] = [];
        if (!bySlug[hyphenKey].includes(titleName)) bySlug[hyphenKey].push(titleName);
      }
    }
    // Tag team titles: also assign to each member so roster/profile show belt for both
    if (isTagTeamTitle(titleName)) {
      const memberSlugs =
        getTagTeamMemberSlugs(key) ??
        getTagTeamMemberSlugs(slug) ??
        parseTagTeamChampionToMemberSlugs(String(championName || rawSlug || ""));
      if (memberSlugs?.length) {
        for (const memberSlug of memberSlugs) {
          const memberKey = canonicalSlug(memberSlug);
          if (!bySlug[memberKey]) bySlug[memberKey] = [];
          if (!bySlug[memberKey].includes(titleName)) bySlug[memberKey].push(titleName);
        }
      }
    }
  }

  return bySlug;
}

/**
 * @param {Record<string, number>[]} maps
 * @returns {Record<string, number>}
 */
export function mergeBeltPointsBySlug(...maps) {
  const out = /** @type {Record<string, number>} */ ({});
  for (const m of maps) {
    if (!m || typeof m !== "object") continue;
    for (const [k, v] of Object.entries(m)) {
      const n = Number(v);
      if (!Number.isFinite(n) || n <= 0) continue;
      out[k] = (out[k] ?? 0) + n;
    }
  }
  return out;
}

/**
 * Public / cross-season belt display: legacy month-ends through Mar 2026 plus weekly PST from Apr 26, 2026.
 * @param {number} [nowMs]
 */
export function computeHybridPublicBeltHoldBySlug(reigns, nowMs = Date.now()) {
  const monthly = computeEndOfMonthBeltPoints(
    reigns,
    FIRST_END_OF_MONTH_POINTS_DATE,
    LAST_CALENDAR_MONTH_END_BEFORE_WEEKLY_BELT,
    nowMs
  );
  const weekly = computeWeeklyBeltHoldPointsAccumulated(
    reigns,
    FIRST_WEEKLY_BELT_WEEK_END_SUNDAY,
    undefined,
    nowMs
  );
  return mergeBeltPointsBySlug(monthly, weekly);
}

/**
 * @param {number} year
 * @param {number} [nowMs]
 */
export function computeHybridBeltHoldBySlugForCalendarYear(reigns, year, nowMs = Date.now()) {
  if (year === 2025) {
    return computeEndOfMonthBeltPoints(reigns, FIRST_END_OF_MONTH_POINTS_DATE, "2025-12-31", nowMs);
  }
  if (year === 2026) {
    const monthly2026 = computeEndOfMonthBeltPoints(
      reigns,
      "2026-01-31",
      LAST_CALENDAR_MONTH_END_BEFORE_WEEKLY_BELT,
      nowMs
    );
    const weekly2026 = computeWeeklyBeltHoldPointsAccumulated(
      reigns,
      FIRST_WEEKLY_BELT_WEEK_END_SUNDAY,
      undefined,
      nowMs
    );
    return mergeBeltPointsBySlug(monthly2026, weekly2026);
  }
  return computeHybridPublicBeltHoldBySlug(reigns, nowMs);
}
