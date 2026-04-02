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

/** First month-end when we award hold points (Jan 2025). Earlier months do not award. */
export const FIRST_END_OF_MONTH_POINTS_DATE = "2025-01-31";

/** Title changes before this date are ignored when inferring reigns. Use so we see e.g. Apr 2025 change (Cody → John Cena). */
export const REIGN_EFFECTIVE_START = "2024-04-01";

/**
 * Completed events on or after this date feed inferReignsFromEvents for monthly belt / reign merge.
 * Must include shows *before* a league starts so who held a title at each month-end inside the league is correct
 * (league-scoped event slices alone miss pre-season title changes that history/changes tables may not list fully).
 */
export const BELT_REIGN_INFERENCE_EVENTS_FROM = "2020-01-01";

/**
 * Last calendar day (UTC) of the month containing `startDate` — first month-end on or after league start for belt points.
 * @param {string} startDate - YYYY-MM-DD
 * @returns {string} YYYY-MM-DD
 */
export function firstMonthEndOnOrAfter(startDate) {
  const d = new Date(String(startDate).slice(0, 10) + "T12:00:00.000Z");
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  return new Date(Date.UTC(y, m + 1, 0)).toISOString().slice(0, 10);
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
 * Belt points per month for holding a title at end of month.
 * Tag Team = 4; Men's & Women's IC & US = 8; top singles (Undisputed WWE, WWE Women's, World Heavyweight, Women's World) = 12.
 * Order matters: more specific patterns first (e.g. women's US before men's US).
 */
const TITLE_POINTS = [
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
 * Get belt points for a title name (end-of-month hold). Returns 12, 8, 4, or default.
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

/** Last day of month (UTC) for the UTC year/month of cursor. @param {Date} cursor - any instant in that month */
function getMonthEndUtc(cursor) {
  return new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0))
    .toISOString()
    .slice(0, 10);
}

/**
 * List of month-end dates (YYYY-MM-DD, UTC calendar) from first eligible through the last completed month (or lastMonthEnd if provided).
 * The current month is excluded until the first day of the next month (UTC), so March 31 awards only once today is past March 31 (e.g. April 1 UTC).
 * @param {string} firstMonthEnd - YYYY-MM-DD (e.g. FIRST_END_OF_MONTH_POINTS_DATE)
 * @param {string} [lastMonthEnd] - optional YYYY-MM-DD; if provided, only month-ends <= this are included (e.g. "2025-12-31" for 2025 only)
 * @returns {string[]}
 */
/** @param {string} firstMonthEnd - YYYY-MM-DD @param {string} [lastMonthEnd] - optional inclusive cap */
export function getCompletedMonthEndsForBeltScoring(firstMonthEnd, lastMonthEnd) {
  return monthEndsSince(firstMonthEnd, lastMonthEnd);
}

function monthEndsSince(firstMonthEnd, lastMonthEnd) {
  const start = new Date(firstMonthEnd + "T12:00:00.000Z");
  const now = new Date();
  const firstOfThisMonthUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const defaultCutoff = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
  const out = [];
  let cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  while (cursor < firstOfThisMonthUtc) {
    const monthEnd = getMonthEndUtc(cursor);
    const inRange =
      monthEnd >= firstMonthEnd &&
      (lastMonthEnd ? monthEnd <= lastMonthEnd : monthEnd < defaultCutoff);
    if (inRange) out.push(monthEnd);
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
  }
  return out;
}

/**
 * Compute belt points for wrestlers who held a title at the end of each month.
 * Uses championship history (e.g. from Pro Wrestling Boxscore) with one row per reign.
 * Points per title: World/Undisputed/WWE Women's/Women's World/Heavyweight = 12, Intercontinental & US (men's and women's) = 8, Tag Team (per member) = 4.
 *
 * Expected reign shape: { champion_slug?, champion_id?, champion?, champion_name?, title?, title_name?, won_date?, start_date?, lost_date?, end_date? }
 * - champion_slug or champion_id: preferred (matches wrestlers.id)
 * - champion or champion_name: display name (normalized to slug via normalizeWrestlerName)
 * - title or title_name: used to look up points (e.g. "Undisputed WWE Championship", "Tag Team")
 * - won_date or start_date, lost_date or end_date: YYYY-MM-DD; lost_date null = still champion
 *
 * @param {Array<{ champion_slug?: string | null, champion_id?: string | null, champion?: string | null, champion_name?: string | null, title?: string | null, title_name?: string | null, won_date?: string | null, start_date?: string | null, lost_date?: string | null, end_date?: string | null }>} reigns
 * @param {string} firstMonthEnd - YYYY-MM-DD; first month-end we award points (e.g. "2025-05-31")
 * @param {string} [lastMonthEnd] - optional YYYY-MM-DD; only month-ends <= this count (e.g. "2025-12-31" for 2025 only)
 * @returns {Record<string, number>} Additional belt points per wrestler slug
 */
export function computeEndOfMonthBeltPoints(reigns, firstMonthEnd, lastMonthEnd) {
  const bySlug = /** @type {Record<string, number>} */ ({});

  if (!reigns?.length || !firstMonthEnd) return bySlug;

  const monthEndDates = monthEndsSince(firstMonthEnd, lastMonthEnd);

  for (const reign of reigns) {
    const championName = reign.champion ?? reign.champion_name ?? "";
    const rawSlug =
      reign.champion_slug ??
      reign.champion_id ??
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
 * Belt points per wrestler for a single month-end (who held which title on that date).
 * Used to add end-of-month title points into a specific week's matchup total.
 * @param {Array<{ champion_slug?, champion_id?, champion?, champion_name?, title?, title_name?, won_date?, start_date?, lost_date?, end_date? }>} reigns
 * @param {string} monthEndDate - YYYY-MM-DD (must be last day of a month)
 * @param {string} firstMonthEnd - YYYY-MM-DD; no points if monthEndDate < firstMonthEnd
 * @returns {Record<string, number>} Belt points per wrestler slug for that month only
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
 * Get title reigns for a single wrestler (for profile display): which titles they held and which month-ends.
 * @param {Array<{ champion_slug?: string | null, champion_id?: string | null, champion?: string | null, champion_name?: string | null, title?: string | null, title_name?: string | null, won_date?: string | null, start_date?: string | null, lost_date?: string | null, end_date?: string | null }>} reigns
 * @param {string} firstMonthEnd - YYYY-MM-DD
 * @param {string} wrestlerSlug - wrestlers.id to match
 * @returns {Array<{ title: string, monthEnds: string[] }>}
 */
export function getTitleReignsForWrestler(reigns, firstMonthEnd, wrestlerSlug) {
  if (!reigns?.length || !firstMonthEnd || !wrestlerSlug) return [];

  const monthEndDates = monthEndsSince(firstMonthEnd);
  const out = /** @type {Array<{ title: string, monthEnds: string[] }>} */ ([]);

  for (const reign of reigns) {
    const championName = reign.champion ?? reign.champion_name ?? "";
    const rawSlug =
      reign.champion_slug ??
      reign.champion_id ??
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
 * Month-end dates (YYYY-MM-DD) where this single reign would count toward fantasy end-of-month belt
 * hold points for the profile wrestler. Matches getTitleReignsForWrestler slug logic, plus tag-team
 * members when the title is a tag championship and champion_slug maps via getTagTeamMemberSlugs /
 * parseTagTeamChampionToMemberSlugs.
 *
 * @param {object} reign - same shape as championship_history / merged reign rows
 * @param {string} firstMonthEnd - e.g. FIRST_END_OF_MONTH_POINTS_DATE
 * @param {string} wrestlerId - wrestlers.id
 * @param {string} [urlSlug] - URL param slug when it differs from id
 * @returns {string[]}
 */
export function getFantasyBeltMonthEndsForReign(reign, firstMonthEnd, wrestlerId, urlSlug) {
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

  const monthEndDates = monthEndsSince(firstMonthEnd);
  return monthEndDates.filter(
    (monthEnd) => monthEnd >= REIGN_EFFECTIVE_START && won <= monthEnd && (lost == null || lost > monthEnd)
  );
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
