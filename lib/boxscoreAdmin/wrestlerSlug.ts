/** URL/database slug from display name (matches PWBS `slugify`). */
export function slugifyWrestlerName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

export function isValidWrestlerSlug(slug: string): boolean {
  return /^[a-z0-9-]+$/.test(slug);
}
