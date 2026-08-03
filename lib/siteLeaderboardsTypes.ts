/** Serializable site leaderboard row (safe for JSON + client). */
export type SiteLeaderboardDisplayRow = {
  userId: string;
  points: number;
  rank: number;
  label: string;
};

export const SITE_LEADERBOARD_SEGMENT_IDS = [
  "public",
  "private",
  "season_overall",
  "head_to_head",
  "salary_cap",
  "main_nxt",
  "main_only",
] as const;

export type SiteLeaderboardSegmentId = (typeof SITE_LEADERBOARD_SEGMENT_IDS)[number];

export type SiteLeaderboardSegment = {
  id: SiteLeaderboardSegmentId;
  title: string;
  description: string;
  seasonTop10: SiteLeaderboardDisplayRow[];
  weeklyTop10: SiteLeaderboardDisplayRow[];
  leagueCount: number;
};

export type SiteLeaderboardsPayload = {
  weekStart: string | null;
  currentWeekStartMondayPst: string | null;
  weeklyPrevWeekStart: string | null;
  weeklyNextWeekStart: string | null;
  /** Site-wide XP boards (not league-format filtered). */
  xpAllTimeTop10: SiteLeaderboardDisplayRow[];
  xpWeeklyTop10: SiteLeaderboardDisplayRow[];
  segments: SiteLeaderboardSegment[];
  siteLeaderboardsAvailable: boolean;
};
