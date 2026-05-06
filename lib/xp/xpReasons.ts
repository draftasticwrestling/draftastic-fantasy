/**
 * Canonical ledger `reason` strings and baseline XP amounts from product spec.
 * Some awards (league placement, weekly high) use helpers that encode team count in reason/metadata.
 */

export const XP_AMOUNTS = {
  daily_login: 1,
  login_streak_3: 5,
  login_streak_10: 10,
  login_streak_30: 25,
  free_agent_move: 3,
  fantasy_points_per_50: 10,
  trade_executed: 10,
  league_joined: 20,
  weekly_high_score: 25,
  league_started: 50,
  league_second_3: 100,
  league_win_3: 500,
  league_second_4: 125,
  league_win_4: 650,
  league_second_5: 150,
  league_win_5: 800,
  league_second_6: 175,
  league_win_6: 950,
} as const;
