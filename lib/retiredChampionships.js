/**
 * Retired championships: history and past fantasy points stay intact.
 * Scoring on/after `retiredAtYmd` awards no title-hold or title-match points for that belt.
 *
 * Add future retirements here (and optionally set championships.retired_at via SQL).
 */

/**
 * @typedef {{
 *   id: string,
 *   retiredAtYmd: string,
 *   displayNames: string[],
 * }} RetiredChampionship
 */

/** @type {readonly RetiredChampionship[]} */
export const RETIRED_CHAMPIONSHIPS = Object.freeze([
  {
    id: "nxt-mens-speed-championship",
    retiredAtYmd: "2026-09-01",
    displayNames: [
      "NXT Men's Speed Championship",
      "Men's Speed Championship",
      "NXT Speed Championship",
    ],
  },
  {
    id: "nxt-womens-speed-championship",
    retiredAtYmd: "2026-09-01",
    displayNames: ["NXT Women's Speed Championship", "Women's Speed Championship"],
  },
]);

/**
 * @param {string | null | undefined} raw
 * @returns {string}
 */
function normalizeTitleKey(raw) {
  return String(raw ?? "")
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[_]+/g, " ")
    .replace(/[-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * @param {string | null | undefined} titleOrId
 * @returns {RetiredChampionship | null}
 */
export function getRetiredChampionshipEntry(titleOrId) {
  const raw = String(titleOrId ?? "").trim();
  if (!raw) return null;
  const asId = raw.toLowerCase().replace(/\s+/g, "-");
  const asKey = normalizeTitleKey(raw);

  for (const entry of RETIRED_CHAMPIONSHIPS) {
    if (entry.id === asId || entry.id === raw.toLowerCase()) return entry;
    if (normalizeTitleKey(entry.id.replace(/-/g, " ")) === asKey) return entry;
    for (const name of entry.displayNames) {
      if (normalizeTitleKey(name) === asKey) return entry;
    }
    // Fuzzy: "men's speed" / "womens speed championship" without NXT prefix
    if (/\b(men'?s?|mens)\s+speed\b/.test(asKey) && entry.id.includes("mens-speed")) return entry;
    if (/\b(women'?s?|womens)\s+speed\b/.test(asKey) && entry.id.includes("womens-speed")) return entry;
  }
  return null;
}

/**
 * First calendar day (YYYY-MM-DD) when this title no longer awards fantasy points, or null if active.
 * @param {string | null | undefined} titleOrId
 * @returns {string | null}
 */
export function getChampionshipRetirementYmd(titleOrId) {
  return getRetiredChampionshipEntry(titleOrId)?.retiredAtYmd ?? null;
}

/**
 * True when `scoringYmd` is on/after the title's retirement date (no hold/defense/win points).
 * @param {string | null | undefined} titleOrId
 * @param {string | null | undefined} scoringYmd - YYYY-MM-DD (week lock, month-end, or event date)
 */
export function isChampionshipRetiredForScoringDate(titleOrId, scoringYmd) {
  const retiredAt = getChampionshipRetirementYmd(titleOrId);
  if (!retiredAt) return false;
  const d = String(scoringYmd ?? "").trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  return d >= retiredAt;
}

/**
 * True if the title is retired as of "today" (UTC civil date) — for current-champion UI.
 * @param {string | null | undefined} titleOrId
 * @param {string | null | undefined} [asOfYmd]
 */
export function isChampionshipRetiredAsOf(titleOrId, asOfYmd) {
  const asOf = (asOfYmd && String(asOfYmd).slice(0, 10)) || new Date().toISOString().slice(0, 10);
  return isChampionshipRetiredForScoringDate(titleOrId, asOf);
}

/**
 * @returns {readonly string[]}
 */
export function listRetiredChampionshipIds() {
  return RETIRED_CHAMPIONSHIPS.map((e) => e.id);
}
