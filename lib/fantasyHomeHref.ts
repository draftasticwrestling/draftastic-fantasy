/**
 * Same destination as the main nav "Fantasy" pill: play funnel when logged out,
 * current/last league when logged in, or `/fantasy` when logged in with no leagues
 * (hub to join or create — not only create).
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
