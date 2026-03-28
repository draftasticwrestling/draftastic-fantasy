/** Format slug like `rhea-ripley` → `Rhea Ripley` when no DB name exists */
export function formatSlug(slug: string): string {
  if (!slug) return slug;
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Replace slugs in a string with display names; longest slugs first to avoid partial matches */
export function replaceSlugsInString(
  str: string | string[] | null | undefined,
  slugToName: Map<string, string>
): string {
  if (str == null) return "";
  const out =
    typeof str === "string" ? str : Array.isArray(str) ? str.join(", ") : String(str);
  if (typeof out !== "string") return "";
  let result = out;
  const sortedSlugs = [...slugToName.keys()].sort(
    (a, b) => b.length - a.length
  );
  for (const slug of sortedSlugs) {
    const name = slugToName.get(slug)!;
    const regex = new RegExp(`\\b${escapeRegex(slug)}\\b`, "gi");
    result = result.replace(regex, name);
  }
  return result;
}
