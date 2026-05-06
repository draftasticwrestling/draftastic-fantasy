/**
 * Wrestling-themed XP titles and thresholds (cumulative XP required to reach each tier).
 * Ordered from lowest to highest.
 */

export type XpLevelDefinition = {
  level: number;
  title: string;
  /** Minimum total XP to display this title (user is "at" this level when totalXp >= minXp). */
  minXp: number;
};

export const XP_LEVELS: readonly XpLevelDefinition[] = [
  { level: 1, title: "Newb", minXp: 0 },
  { level: 2, title: "Unpaid Intern", minXp: 25 },
  { level: 3, title: "Local Talent", minXp: 60 },
  { level: 4, title: "Enhancement Talent", minXp: 105 },
  { level: 5, title: "Jobber", minXp: 160 },
  { level: 6, title: "Indie Rookie", minXp: 225 },
  { level: 7, title: "Dark Match Regular", minXp: 300 },
  { level: 8, title: "Ring Crew Favorite", minXp: 385 },
  { level: 9, title: "Opening Matcher", minXp: 480 },
  { level: 10, title: "Undercard Grinder", minXp: 585 },
  { level: 11, title: "Prospect", minXp: 700 },
  { level: 12, title: "Breakout Hopeful", minXp: 825 },
  { level: 13, title: "Crowd Warm-Up", minXp: 960 },
  { level: 14, title: "Midcard Fill-In", minXp: 1105 },
  { level: 15, title: "Solid Hand", minXp: 1260 },
  { level: 16, title: "Workhorse", minXp: 1425 },
  { level: 17, title: "TV Regular", minXp: 1600 },
  { level: 18, title: "Midcard Mainstay", minXp: 1785 },
  { level: 19, title: "Fan Favorite", minXp: 1980 },
  { level: 20, title: "Heat Magnet", minXp: 2185 },
  { level: 21, title: "Rising Star", minXp: 2400 },
  { level: 22, title: "Spotlight Stealer", minXp: 2625 },
  { level: 23, title: "Promo Cutter", minXp: 2860 },
  { level: 24, title: "Feud Builder", minXp: 3105 },
  { level: 25, title: "Upper Midcarder", minXp: 3360 },
  { level: 26, title: "Gate Crasher", minXp: 3625 },
  { level: 27, title: "Main Event Tease", minXp: 3900 },
  { level: 28, title: "Main Eventer", minXp: 4150 },
  { level: 29, title: "Headliner", minXp: 4375 },
  { level: 30, title: "Locker Room Leader", minXp: 4575 },
  { level: 31, title: "Franchise Player", minXp: 4800 },
  { level: 32, title: "Company Guy", minXp: 5050 },
  { level: 33, title: "Box Office Draw", minXp: 5325 },
  { level: 34, title: "Pay-Per-View Star", minXp: 5625 },
  { level: 35, title: "Championship Contender", minXp: 5950 },
  { level: 36, title: "World Title Threat", minXp: 6300 },
  { level: 37, title: "World Champion", minXp: 6675 },
  { level: 38, title: "Dominant Champion", minXp: 7075 },
  { level: 39, title: "Face of the Brand", minXp: 7500 },
  { level: 40, title: "Era Definer", minXp: 7900 },
  { level: 41, title: "Hall of Fame Bound", minXp: 8300 },
  { level: 42, title: "Living Legend", minXp: 8750 },
  { level: 43, title: "Icon", minXp: 9200 },
  { level: 44, title: "Immortal", minXp: 9500 },
  { level: 45, title: "All-Time Great", minXp: 9600 },
  { level: 46, title: "Mount Rushmore", minXp: 9650 },
  { level: 47, title: "Legend Killer", minXp: 9700 },
  { level: 48, title: "Undisputed Icon", minXp: 9725 },
  { level: 49, title: "Wrestling God", minXp: 9750 },
  { level: 50, title: "Greatest of All Time", minXp: 10000 },
] as const;

export type XpLevelInfo = {
  level: number;
  label: string;
  title: string;
  minXp: number;
  nextLevel: number | null;
  nextLabel: string | null;
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
      level: current.level,
      label: `Level ${current.level} — ${current.title}`,
      title: current.title,
      minXp: current.minXp,
      nextLevel: null,
      nextLabel: null,
      nextTitle: null,
      nextMinXp: null,
      progressToNext: 1,
    };
  }
  const span = next.minXp - current.minXp;
  const into = xp - current.minXp;
  const progressToNext = span > 0 ? Math.min(1, Math.max(0, into / span)) : 1;
  return {
    level: current.level,
    label: `Level ${current.level} — ${current.title}`,
    title: current.title,
    minXp: current.minXp,
    nextLevel: next.level,
    nextLabel: `Level ${next.level} — ${next.title}`,
    nextTitle: next.title,
    nextMinXp: next.minXp,
    progressToNext,
  };
}
