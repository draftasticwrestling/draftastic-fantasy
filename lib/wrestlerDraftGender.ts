/**
 * Normalizes wrestler.gender from the DB/API for draft rules (priority female counts, roster balance).
 * Keep in sync with any server-side autopick logic that uses the same rules.
 */
export function normalizeDraftPoolGender(g: string | null | undefined): "F" | "M" | null {
  if (g == null || g === "") return null;
  const l = String(g).toLowerCase().trim();
  if (
    l === "female" ||
    l === "f" ||
    l === "woman" ||
    l === "women" ||
    l === "girl" ||
    l === "she" ||
    l.startsWith("fem")
  ) {
    return "F";
  }
  if (l === "male" || l === "m" || l === "man" || l === "men" || l === "boy" || l.startsWith("mal")) {
    return "M";
  }
  return null;
}
