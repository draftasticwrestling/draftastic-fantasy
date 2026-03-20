/**
 * Gender filter for wrestler tables (League Leaders, draft room, etc.).
 * Matches behavior in WrestlerList: unknown gender shows only when both Male and Female are selected.
 */

export type GenderFilterable = { gender: string | null | undefined };

export function genderFilterKey(w: GenderFilterable): "M" | "F" | "U" {
  const g = w.gender;
  if (g == null || !String(g).trim()) return "U";
  const lower = String(g).trim().toLowerCase();
  if (lower === "male" || lower === "m") return "M";
  if (lower === "female" || lower === "f") return "F";
  return "U";
}

export function passesGenderFilter(
  w: GenderFilterable,
  includeMale: boolean,
  includeFemale: boolean
): boolean {
  const k = genderFilterKey(w);
  if (k === "M") return includeMale;
  if (k === "F") return includeFemale;
  return includeMale && includeFemale;
}
