import { normalizeWrestlerName } from "./parsers/participantParser.js";

/**
 * Normalize a championship label for tag detection / belt tier matching when the feed uses
 * hyphens or underscores instead of spaces (e.g. "womens-tag-team-championship").
 */
export function normalizeChampionshipTitleForScoring(titleRaw) {
  if (!titleRaw || typeof titleRaw !== "string") return "";
  return String(titleRaw)
    .replace(/[\u2018\u2019\u201A\u201B\u2032']/g, "")
    .trim()
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ");
}

/**
 * Maps tag team champion slug (as stored in championship_history / championship_changes)
 * to the individual wrestler slugs so both members get the title for belt display.
 * Keys and values use normalized slug form (e.g. "the-usos" -> ["jey-uso", "jimmy-uso"]).
 */
const TAG_TEAM_TO_MEMBER_SLUGS = {
  "the-usos": ["jey-uso", "jimmy-uso"],
  "jey-uso-and-jimmy-uso": ["jey-uso", "jimmy-uso"],
  "jey-usojimmy-uso": ["jey-uso", "jimmy-uso"],
  "solo-sikoa-and-tama-tonga": ["solo-sikoa", "tama-tonga"],
  "solo-sikoa-tama-tonga": ["solo-sikoa", "tama-tonga"],
  "solo-sikoatama-tonga": ["solo-sikoa", "tama-tonga"],
  "tama-tonga-and-solo-sikoa": ["solo-sikoa", "tama-tonga"],
  "tama-tonga-solo-sikoa": ["solo-sikoa", "tama-tonga"],
  "nia-jax-and-lash-legend": ["nia-jax", "lash-legend"],
  "nia-jax-lash-legend": ["nia-jax", "lash-legend"],
  "nia-jaxlash-legend": ["nia-jax", "lash-legend"],
  "lash-legend-and-nia-jax": ["nia-jax", "lash-legend"],
  "lash-legend-nia-jax": ["nia-jax", "lash-legend"],
  "lash-legendnia-jax": ["nia-jax", "lash-legend"],
  "the-bella-twins": ["nikki-bella", "brie-bella"],
  "bella-twins": ["nikki-bella", "brie-bella"],
  "nikki-bella-and-brie-bella": ["nikki-bella", "brie-bella"],
  "nikki-bella-brie-bella": ["nikki-bella", "brie-bella"],
  "brie-bella-and-nikki-bella": ["nikki-bella", "brie-bella"],
  "brie-bella-nikki-bella": ["nikki-bella", "brie-bella"],
  "nia-jax": ["nia-jax", "lash-legend"],
  "lash-legend": ["nia-jax", "lash-legend"],
  "nikki-bella": ["nikki-bella", "brie-bella"],
  "brie-bella": ["nikki-bella", "brie-bella"],
  "solo-sikoa": ["solo-sikoa", "tama-tonga"],
  "tama-tonga": ["solo-sikoa", "tama-tonga"],
  "the-usos-jey-uso--jimmy-uso": ["jey-uso", "jimmy-uso"],
  "the-irresistible-forces": ["nia-jax", "lash-legend"],
  "the-mfts": ["solo-sikoa", "tama-tonga"],
  /** Raw Tag Team — Boxscore team slug; both members need belt UI + monthly credit */
  "the-vision": ["logan-paul", "austin-theory"],
  /** NXT Tag — PWBS team slug / vanity moniker */
  "the-vanity-project": ["brad-baylor", "ricky-smokes"],
  /** World / SmackDown Tag — Boxscore often uses hyphen slug with -and- */
  "damian-priest-and-r-truth": ["damian-priest", "r-truth"],
  "damian-priest-r-truth": ["damian-priest", "r-truth"],
  "priest-and-r-truth": ["damian-priest", "r-truth"],
  /** Alternate spelling from some feeds */
  "the-irresistable-forces": ["nia-jax", "lash-legend"],
};

/**
 * @param {string} championSlug - normalized slug from reign (e.g. "the-usos")
 * @returns {string[] | null} member slugs if this is a known tag team, else null
 */
export function getTagTeamMemberSlugs(championSlug) {
  if (!championSlug || typeof championSlug !== "string") return null;
  const key = championSlug.toLowerCase().trim();
  return (
    TAG_TEAM_TO_MEMBER_SLUGS[key] ?? TAG_TEAM_TO_MEMBER_SLUGS[key.replace(/_/g, "-")] ?? null
  );
}

const THE_VISION_RAW_TAG_MEMBERS = ["logan-paul", "austin-theory"];

/**
 * Raw Tag reign rows sometimes list only one member slug after sync lag. Credit both The Vision members.
 * Skip when slug is already the team name or both individuals appear on the row.
 */
const PRIEST_TRUTH_TAG_MEMBERS = ["damian-priest", "r-truth"];

/**
 * Men's / WWE / World / SmackDown tag reign rows may list only one member slug; credit both Priest & R-Truth.
 * Excludes women's tag (Nia/Lash path). Titles like "WWE Tag Team Championship" have no "world tag" substring —
 * those were skipped when we only matched world/smackdown.
 */
export function expandWorldTagPriestTruthIfSingleMemberListed(titleName, key, slug, rawSlug) {
  if (!isTagTeamTitle(titleName)) return null;
  const t = normalizeChampionshipTitleForScoring(titleName);
  if (/women'?s?\s+tag\b|wwe\s+women'?s?\s+tag\b|women'?s?\s+tag\s+team/i.test(t)) return null;
  const bits = [key, slug, rawSlug]
    .filter(Boolean)
    .map((x) => normalizeWrestlerName(String(x).replace(/_/g, "-")))
    .filter(Boolean);
  const set = new Set(bits);
  if (set.has("damian-priest") && set.has("r-truth")) return null;
  if (set.has("damian-priest") || set.has("r-truth")) {
    return [...PRIEST_TRUTH_TAG_MEMBERS];
  }
  return null;
}

/**
 * Women's tag: if only one Irresistible Forces member appears on the row, credit both (sync quirks).
 */
export function expandWomensTagNiaLashIfSingleMemberListed(titleName, key, slug, rawSlug) {
  if (!isTagTeamTitle(titleName)) return null;
  const t = normalizeChampionshipTitleForScoring(titleName);
  if (
    !/women'?s?\s+tag|wwe\s+women'?s?\s+tag|women'?s?\s+.*\btag\b.*team|irresist/i.test(t)
  ) {
    return null;
  }
  const bits = [key, slug, rawSlug]
    .filter(Boolean)
    .map((x) => normalizeWrestlerName(String(x).replace(/_/g, "-")))
    .filter(Boolean);
  const set = new Set(bits);
  if (
    (set.has("nia-jax") && set.has("lash-legend")) ||
    (set.has("nikki-bella") && set.has("brie-bella"))
  ) {
    return null;
  }
  if (set.has("the-irresistible-forces") || set.has("the-irresistable-forces")) return null;
  if (set.has("the-bella-twins") || set.has("bella-twins")) return null;
  if (set.has("nia-jax") || set.has("lash-legend")) {
    return ["nia-jax", "lash-legend"];
  }
  if (set.has("nikki-bella") || set.has("brie-bella")) {
    return ["nikki-bella", "brie-bella"];
  }
  return null;
}

export function expandRawTagTheVisionIfSingleMemberListed(titleName, key, slug, rawSlug) {
  if (!isTagTeamTitle(titleName)) return null;
  const t = normalizeChampionshipTitleForScoring(titleName);
  if (!/raw\s+tag/i.test(t)) return null;
  const bits = [key, slug, rawSlug]
    .filter(Boolean)
    .map((x) => normalizeWrestlerName(String(x).replace(/_/g, "-")))
    .filter(Boolean);
  const set = new Set(bits);
  if (set.has("the-vision")) return null;
  if (set.has("logan-paul") && set.has("austin-theory")) return null;
  if (set.has("logan-paul") || set.has("austin-theory")) {
    return [...THE_VISION_RAW_TAG_MEMBERS];
  }
  return null;
}

/**
 * Split "A & B" / "A and B" into normalized member slugs.
 * @param {string} s
 * @returns {string[] | null}
 */
function splitTagTeamNamesToSlugs(s) {
  const parts = s
    .split(/\s+and\s+|\s*&\s*/i)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length < 2) return null;
  const slugs = parts.map((p) => normalizeWrestlerName(p)).filter(Boolean);
  return slugs.length >= 2 ? slugs : null;
}

/**
 * Parse a tag team champion string like "Jey Uso & Jimmy Uso" or "Jey Uso and Jimmy Uso"
 * into normalized member slugs so both get the title.
 * Also handles "The Vision (Logan Paul & Austin Theory)" where the only & is inside parentheses
 * (splitting the full string would break without this).
 * @param {string} str - champion or champion_slug from DB
 * @returns {string[] | null} ["jey-uso", "jimmy-uso"] or null if not parseable as two members
 */
export function parseTagTeamChampionToMemberSlugs(str) {
  if (!str || typeof str !== "string") return null;
  const trimmed = str.trim();
  // Boxscore champion_slug: "damian-priest-and-r-truth" (hyphens, no spaces around "and")
  const slugAnd = trimmed.match(/^([a-z0-9_-]+)-and-([a-z0-9_-]+)$/i);
  if (slugAnd) {
    const a = normalizeWrestlerName(slugAnd[1].replace(/_/g, "-").replace(/-/g, " "));
    const b = normalizeWrestlerName(slugAnd[2].replace(/_/g, "-").replace(/-/g, " "));
    if (a && b) return [a, b];
  }
  const parenMatch = trimmed.match(/\(\s*([^)]+?)\s*\)/);
  if (parenMatch) {
    const fromInner = splitTagTeamNamesToSlugs(parenMatch[1]);
    if (fromInner) return fromInner;
  }
  return splitTagTeamNamesToSlugs(trimmed);
}

/**
 * @param {string} titleName - e.g. "Raw Tag Team Championship"
 * @returns {boolean}
 */
export function isTagTeamTitle(titleName) {
  if (!titleName || typeof titleName !== "string") return false;
  const s = normalizeChampionshipTitleForScoring(titleName);
  return /tag\s+team|raw\s+tag|smackdown\s+tag|world\s+tag|women'?s?\s+tag\b|wwe\s+women'?s?\s+tag\b/i.test(s);
}
