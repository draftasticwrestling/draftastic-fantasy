/**
 * Maps tag team champion slug (as stored in championship_history / championship_changes)
 * to the individual wrestler slugs so both members get the title for belt display.
 * Keys and values use normalized slug form (e.g. "the-usos" -> ["jey-uso", "jimmy-uso"]).
 */
const TAG_TEAM_TO_MEMBER_SLUGS = {
  "the-usos": ["jey-uso", "jimmy-uso"],
  "jey-uso-and-jimmy-uso": ["jey-uso", "jimmy-uso"],
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
 * @param {string} titleName - e.g. "Raw Tag Team Championship"
 * @returns {boolean}
 */
export function isTagTeamTitle(titleName) {
  if (!titleName || typeof titleName !== "string") return false;
  return /tag\s+team|raw\s+tag|smackdown\s+tag|world\s+tag/i.test(titleName.trim());
}
