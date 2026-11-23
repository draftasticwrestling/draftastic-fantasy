/**
 * Same destination as the main nav "Fantasy" pill.
 * Logged out: the play funnel.
 * Logged in with a current league: that league.
 * Logged in with no current league: the career page. That page sends someone who has
 * never joined a league on to the play funnel.
 */

import { PLAY_PATH } from "@/lib/playFunnel";

export type FantasyLeagueItem = {
  slug: string;
  name: string;
  role: "commissioner" | "owner";
  league_type?: string | null;
};

export function getLeagueSlugFromPath(pathname: string): string | null {
  if (!pathname.startsWith("/leagues/")) return null;
  const parts = pathname.slice(1).split("/");
  if (parts[1] === "new" || parts[1] === "join" || !parts[1]) return null;
  return parts[1];
}

export function computeFantasyHomeHref(args: {
  user: { id: string } | null;
  pathname: string;
  leagues: FantasyLeagueItem[];
  lastVisitedSlug: string | null;
}): string {
  const { user, pathname, leagues, lastVisitedSlug } = args;
  const slugFromPath = getLeagueSlugFromPath(pathname);
  const currentLeagueSlug =
    slugFromPath ??
    (lastVisitedSlug && leagues.some((l) => l.slug === lastVisitedSlug) ? lastVisitedSlug : null) ??
    leagues[0]?.slug ??
    null;

  if (!user) return PLAY_PATH;
  if (currentLeagueSlug) return `/leagues/${currentLeagueSlug}`;
  return "/fantasy";
}
