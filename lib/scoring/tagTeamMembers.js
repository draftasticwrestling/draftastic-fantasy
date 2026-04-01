import { normalizeWrestlerName } from "./parsers/participantParser.js";

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
  "nia-jax": ["nia-jax", "lash-legend"],
  "lash-legend": ["nia-jax", "lash-legend"],
  "solo-sikoa": ["solo-sikoa", "tama-tonga"],
  "tama-tonga": ["solo-sikoa", "tama-tonga"],
  "the-usos-jey-uso--jimmy-uso": ["jey-uso", "jimmy-uso"],
  "the-irresistible-forces": ["nia-jax", "lash-legend"],
  "the-mfts": ["solo-sikoa", "tama-tonga"],
  /** Raw Tag Team — Boxscore team slug; both members need belt UI + monthly credit */
  "the-vision": ["logan-paul", "austin-theory"],
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
export function expandRawTagTheVisionIfSingleMemberListed(titleName, key, slug, rawSlug) {
  if (!isTagTeamTitle(titleName)) return null;
  if (!/raw\s+tag/i.test(String(titleName))) return null;
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
  return /tag\s+team|raw\s+tag|smackdown\s+tag|world\s+tag/i.test(titleName.trim());
}
