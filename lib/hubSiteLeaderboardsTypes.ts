/** Serializable hub leaderboard row (safe for JSON + client). */
export type HubLeaderboardDisplayRow = {
  userId: string;
  points: number;
  rank: number;
  label: string;
};

export type HubSiteLeaderboardsPayload = {
  weekStart: string | null;
  currentWeekStartMondayPst: string | null;
  weeklyPrevWeekStart: string | null;
  weeklyNextWeekStart: string | null;
  weeklyTop10: HubLeaderboardDisplayRow[];
  seasonTop10: HubLeaderboardDisplayRow[];
  hubLeaderboardsAvailable: boolean;
};
