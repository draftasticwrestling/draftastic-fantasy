/**
 * Example league and team members.
 * Replace with Supabase (leagues, teams, rosters) when you add auth and draft.
 */

export const EXAMPLE_LEAGUE = {
  name: "Example League",
  slug: "example",
} as const;

export const LEAGUE_MEMBERS = [
  { name: "Christopher Cramer", slug: "christopher-cramer" },
  { name: "Caleb Warren", slug: "caleb-warren" },
  { name: "Josh Dill", slug: "josh-dill" },
  { name: "Kenny Walker", slug: "kenny-walker" },
  { name: "Kyle Morrow", slug: "kyle-morrow" },
  { name: "Trevor Jones", slug: "trevor-jones" },
] as const;

export type LeagueMemberSlug = (typeof LEAGUE_MEMBERS)[number]["slug"];

export function getMemberBySlug(slug: string) {
  return LEAGUE_MEMBERS.find((m) => m.slug === slug) ?? null;
}

export function getAllSlugs(): string[] {
  return LEAGUE_MEMBERS.map((m) => m.slug);
}
