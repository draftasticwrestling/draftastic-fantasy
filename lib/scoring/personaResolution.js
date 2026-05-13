/**
 * Resolve wrestler personas/aliases to the canonical wrestler slug by date.
 * Used so points are attributed to the correct person when a name is shared or changes hands.
 *
 * Rules:
 * - El Grande Americano:
 *   - Before 2025-06-30: Chad Gable
 *   - From 2025-06-30: Ludwig Kaiser
 * - Original El Grande Americano:
 *   - From 2026-01-31 (Royal Rumble): Chad Gable
 * - Bravo Americano:
 *   - From 2025-09-29: Tyler Bate
 * - Rayo Americano:
 *   - From 2025-09-29: Pete Dunne
 * - Bruto Credo → Brutus Creed; Julio Credo → Julius Creed (alter-ego billing)
 */

const EGA_CHAD_END = "2025-06-29"; // last date EGA = Chad Gable
const EGA_LUDWIG_START = "2025-06-30";
const ORIGINAL_EGA_CHAD_START = "2026-01-31"; // Royal Rumble: Original EGA = Chad Gable
const AMERICANO_ALIAS_START = "2025-09-29";

/**
 * Resolve a participant slug (and optional event/reign date) to the canonical wrestler slug.
 * @param {string} participantSlug - Normalized name slug (e.g. "el-grande-americano", "original-el-grande-americano")
 * @param {string} [eventDate] - YYYY-MM-DD of the event or reign start
 * @returns {string|null} Canonical wrestler slug, or null if no override (use participantSlug as-is)
 */
export function resolvePersonaToCanonical(participantSlug, eventDate) {
  if (!participantSlug || typeof participantSlug !== "string") return null;
  const slug = participantSlug.toLowerCase().trim();
  const date = (eventDate || "").slice(0, 10);

  // Original El Grande Americano: from Jan 31 2026 → Chad Gable
  if (slug === "original-el-grande-americano") {
    return date >= ORIGINAL_EGA_CHAD_START ? "chad-gable" : null;
  }

  // El Grande Americano (no "Original")
  if (slug === "el-grande-americano") {
    if (date <= EGA_CHAD_END) return "chad-gable";
    if (date >= EGA_LUDWIG_START) return "ludwig-kaiser";
    return null;
  }

  if (slug === "bravo-americano") {
    return date >= AMERICANO_ALIAS_START ? "tyler-bate" : null;
  }

  if (slug === "rayo-americano") {
    return date >= AMERICANO_ALIAS_START ? "pete-dunne" : null;
  }

  if (slug === "bruto-credo") return "brutus-creed";
  if (slug === "julio-credo") return "julius-creed";

  return null;
}

/**
 * Canonical/real-name wrestler rows hidden from league leaders, free agents, and main wrestlers directory.
 * The gimmick row (Rayo Americano, Bravo Americano, El Grande Americano, Original El Grande Americano,
 * Bruto Credo, Julio Credo) is primary; points aggregate under the canonical slug — lists merge via draftAliasListMerge.
 */
const HIDDEN_PRIMARY_LIST_CANONICAL_SLUGS = new Set([
  "pete-dunne",
  "tyler-bate",
  "ludwig-kaiser",
  "chad-gable",
  "brutus-creed",
  "julius-creed",
]);

/** Draft alias groups: drafting one blocks the others in the same group. */
const DRAFT_ALIAS_GROUPS = [
  ["el-grande-americano", "ludwig-kaiser"],
  ["original-el-grande-americano", "chad-gable"],
  ["bravo-americano", "tyler-bate"],
  ["rayo-americano", "pete-dunne"],
  ["bruto-credo", "brutus-creed"],
  ["julio-credo", "julius-creed"],
];

/**
 * Hide canonical alter-ego rows from public wrestler lists (show Rayo/Bravo/EGA/OGEGA instead).
 * @param {string} wrestlerSlug - wrestlers.id
 * @returns {boolean}
 */
export function isHiddenCanonicalListSlug(wrestlerSlug) {
  if (!wrestlerSlug || typeof wrestlerSlug !== "string") return false;
  return HIDDEN_PRIMARY_LIST_CANONICAL_SLUGS.has(wrestlerSlug.toLowerCase().trim());
}

/**
 * Display text for alter-ego personas (for Chad Gable / Ludwig Kaiser rows).
 * @param {string} canonicalSlug - chad-gable or ludwig-kaiser
 * @returns {string|null} e.g. "Also: El Grande Americano (through Jun 2025); Original El Grande Americano (from Jan 2026)" or null
 */
export function getPersonasForDisplay(canonicalSlug) {
  if (!canonicalSlug || typeof canonicalSlug !== "string") return null;
  const slug = canonicalSlug.toLowerCase().trim();
  if (slug === "chad-gable") {
    return "Also: El Grande Americano (through Jun 2025); Original El Grande Americano (from Jan 2026)";
  }
  if (slug === "ludwig-kaiser") {
    return "Also: El Grande Americano (from Jun 2025)";
  }
  if (slug === "tyler-bate") {
    return "Also: Bravo Americano (from Sep 2025)";
  }
  if (slug === "pete-dunne") {
    return "Also: Rayo Americano (from Sep 2025)";
  }
  if (slug === "brutus-creed") {
    return "Also: Bruto Credo";
  }
  if (slug === "julius-creed") {
    return "Also: Julio Credo";
  }
  return null;
}

/**
 * Footnote under the primary gimmick row (league leaders / free agents) pointing at the performer’s other billing.
 * @param {string} personaSlug - e.g. rayo-americano
 * @returns {string|null}
 */
export function getPrimaryPersonaAlterEgoNote(personaSlug) {
  if (!personaSlug || typeof personaSlug !== "string") return null;
  const slug = personaSlug.toLowerCase().trim();
  if (slug === "rayo-americano") return "Also known as Pete Dunne";
  if (slug === "bravo-americano") return "Also known as Tyler Bate";
  if (slug === "el-grande-americano") return "Also known as Ludwig Kaiser";
  if (slug === "original-el-grande-americano") return "Also known as Chad Gable";
  if (slug === "bruto-credo") return "Also known as Brutus Creed";
  if (slug === "julio-credo") return "Also known as Julius Creed";
  return null;
}

/**
 * League list footnote: prefer gimmick→performer note, else legacy canonical→gimmick note (e.g. remaining roster views).
 * @param {string} wrestlerId
 * @returns {string|null}
 */
export function getListPersonaFootnote(wrestlerId) {
  return getPrimaryPersonaAlterEgoNote(wrestlerId) ?? getPersonasForDisplay(wrestlerId);
}

/**
 * Draft equivalents for mutual exclusivity (case-normalized slugs).
 * @param {string} wrestlerSlug
 * @returns {string[]} includes wrestlerSlug itself and linked alter-ego slugs
 */
export function draftEquivalentSlugs(wrestlerSlug) {
  if (!wrestlerSlug || typeof wrestlerSlug !== "string") return [];
  const slug = wrestlerSlug.toLowerCase().trim();
  if (!slug) return [];
  for (const group of DRAFT_ALIAS_GROUPS) {
    if (group.includes(slug)) return [...group];
  }
  return [slug];
}
