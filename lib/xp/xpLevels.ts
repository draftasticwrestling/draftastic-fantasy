/**
 * Wrestling-themed XP titles and thresholds (cumulative XP required to reach each tier).
 * Ordered from lowest to highest.
 */

export type XpLevelDefinition = {
  title: string;
  /** Minimum total XP to display this title (user is "at" this level when totalXp >= minXp). */
  minXp: number;
};

export const XP_LEVELS: readonly XpLevelDefinition[] = [
  { title: "Newb", minXp: 0 },
  { title: "Unpaid Intern", minXp: 25 },
  { title: "Local Talent", minXp: 60 },
  { title: "Enhancement Talent", minXp: 105 },
  { title: "Jobber", minXp: 160 },
  { title: "Indie Rookie", minXp: 225 },
  { title: "Dark Match Regular", minXp: 300 },
  { title: "Ring Crew Favorite", minXp: 385 },
  { title: "Opening Matcher", minXp: 480 },
  { title: "Undercard Grinder", minXp: 585 },
  { title: "Prospect", minXp: 700 },
  { title: "Breakout Hopeful", minXp: 825 },
  { title: "Crowd Warm-Up", minXp: 960 },
  { title: "Midcard Fill-In", minXp: 1105 },
  { title: "Solid Hand", minXp: 1260 },
  { title: "Workhorse", minXp: 1425 },
  { title: "TV Regular", minXp: 1600 },
  { title: "Midcard Mainstay", minXp: 1785 },
  { title: "Fan Favorite", minXp: 1980 },
  { title: "Heat Magnet", minXp: 2185 },
  { title: "Rising Star", minXp: 2400 },
  { title: "Spotlight Stealer", minXp: 2625 },
  { title: "Promo Cutter", minXp: 2860 },
  { title: "Feud Builder", minXp: 3105 },
  { title: "Upper Midcarder", minXp: 3360 },
  { title: "Gate Crasher", minXp: 3625 },
  { title: "Main Event Tease", minXp: 3900 },
  { title: "Main Eventer", minXp: 4150 },
  { title: "Headliner", minXp: 4375 },
  { title: "Locker Room Leader", minXp: 4575 },
  { title: "Franchise Player", minXp: 4800 },
  { title: "Company Guy", minXp: 5050 },
  { title: "Box Office Draw", minXp: 5325 },
  { title: "Pay-Per-View Star", minXp: 5625 },
  { title: "Championship Contender", minXp: 5950 },
  { title: "World Title Threat", minXp: 6300 },
  { title: "World Champion", minXp: 6675 },
  { title: "Dominant Champion", minXp: 7075 },
  { title: "Face of the Brand", minXp: 7500 },
  { title: "Era Definer", minXp: 7900 },
  { title: "Hall of Fame Bound", minXp: 8300 },
  { title: "Living Legend", minXp: 8750 },
  { title: "Icon", minXp: 9200 },
  { title: "Immortal", minXp: 9500 },
  { title: "All-Time Great", minXp: 9600 },
  { title: "Mount Rushmore", minXp: 9650 },
  { title: "Legend Killer", minXp: 9700 },
  { title: "Undisputed Icon", minXp: 9725 },
  { title: "Wrestling God", minXp: 9750 },
  { title: "Greatest of All Time", minXp: 10000 },
] as const;

export type XpLevelInfo = {
  title: string;
  minXp: number;
  nextTitle: string | null;
  nextMinXp: number | null;
  progressToNext: number;
};

/**
 * Current title is the highest level whose minXp <= totalXp.
 */
export function getXpLevelInfo(totalXp: number): XpLevelInfo {
  const xp = Math.max(0, Math.floor(Number(totalXp) || 0));
  let current = XP_LEVELS[0];
  for (const row of XP_LEVELS) {
    if (xp >= row.minXp) current = row;
    else break;
  }
  const idx = XP_LEVELS.indexOf(current);
  const next = idx >= 0 && idx < XP_LEVELS.length - 1 ? XP_LEVELS[idx + 1] : null;
  if (!next) {
    return {
      title: current.title,
      minXp: current.minXp,
      nextTitle: null,
      nextMinXp: null,
      progressToNext: 1,
    };
  }
  const span = next.minXp - current.minXp;
  const into = xp - current.minXp;
  const progressToNext = span > 0 ? Math.min(1, Math.max(0, into / span)) : 1;
  return {
    title: current.title,
    minXp: current.minXp,
    nextTitle: next.title,
    nextMinXp: next.minXp,
    progressToNext,
  };
}
