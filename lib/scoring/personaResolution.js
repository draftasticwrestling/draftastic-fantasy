/**
 * Resolve wrestler personas/aliases to the canonical wrestler slug by date.
 * Used so points are attributed to the correct person when a name is shared or changes hands.
 *
 * Rules (El Grande Americano):
 * - Before 2025-06-30: "El Grande Americano" was Chad Gable.
 * - From 2025-06-30: Ludwig Kaiser took over "El Grande Americano".
 * - From 2026-01-31 (Royal Rumble): Chad Gable returned as "Original El Grande Americano";
 *   points for "Original El Grande Americano" go to Chad Gable; "El Grande Americano" stays Ludwig Kaiser.
 */

const EGA_CHAD_END = "2025-06-29"; // last date EGA = Chad Gable
const EGA_LUDWIG_START = "2025-06-30";
const ORIGINAL_EGA_CHAD_START = "2026-01-31"; // Royal Rumble: Original EGA = Chad Gable

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

  return null;
}

/** Slugs that are persona-only (should not appear as separate wrestlers in lists). */
const PERSONA_ONLY_SLUGS = new Set(["el-grande-americano", "original-el-grande-americano"]);

/**
 * Whether this wrestler id/slug is a persona-only identity (points go to another wrestler; hide from lists).
 * @param {string} wrestlerSlug - wrestlers.id or normalized name
 * @returns {boolean}
 */
export function isPersonaOnlySlug(wrestlerSlug) {
  if (!wrestlerSlug || typeof wrestlerSlug !== "string") return false;
  return PERSONA_ONLY_SLUGS.has(wrestlerSlug.toLowerCase().trim());
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
  return null;
}
