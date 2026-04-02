/**
 * URL slug for championship routes, aligned with Pro Wrestling Boxscore paths
 * (e.g. /championship/wwe-championship).
 */
export function titleToChampionshipSlug(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Resolve DB title string from a path slug; returns null if no title matches. */
export function resolveTitleFromChampionshipSlug(slug: string, titles: Iterable<string>): string | null {
  const want = slug.trim().toLowerCase();
  for (const t of titles) {
    if (titleToChampionshipSlug(t) === want) return t;
  }
  return null;
}
