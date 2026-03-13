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
};

/**
 * @param {string} championSlug - normalized slug from reign (e.g. "the-usos")
 * @returns {string[] | null} member slugs if this is a known tag team, else null
 */
export function getTagTeamMemberSlugs(championSlug) {
  if (!championSlug || typeof championSlug !== "string") return null;
  const key = championSlug.toLowerCase().trim();
  return TAG_TEAM_TO_MEMBER_SLUGS[key] ?? null;
}

/**
 * Parse a tag team champion string like "Jey Uso & Jimmy Uso" or "Jey Uso and Jimmy Uso"
 * into normalized member slugs so both get the title.
 * @param {string} str - champion or champion_slug from DB
 * @returns {string[] | null} ["jey-uso", "jimmy-uso"] or null if not parseable as two members
 */
export function parseTagTeamChampionToMemberSlugs(str) {
  if (!str || typeof str !== "string") return null;
  const parts = str
    .split(/\s+and\s+|\s*&\s*/i)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length < 2) return null;
  const slugs = parts.map((p) => normalizeWrestlerName(p)).filter(Boolean);
  return slugs.length >= 2 ? slugs : null;
}

/**
 * @param {string} titleName - e.g. "Raw Tag Team Championship"
 * @returns {boolean}
 */
export function isTagTeamTitle(titleName) {
  if (!titleName || typeof titleName !== "string") return false;
  return /tag\s+team|raw\s+tag|smackdown\s+tag|world\s+tag/i.test(titleName.trim());
}
