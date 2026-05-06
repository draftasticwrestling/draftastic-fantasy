-- Admin / audit: weekly snapshot + XP (run in Supabase SQL editor)
-- See Site admin → Weekly leaderboards & XP for the same queries in-app.

-- Snapshot coverage by league + week
SELECT
  league_id,
  week_start,
  COUNT(*)::int AS member_rows,
  SUM(CASE WHEN is_weekly_high THEN 1 ELSE 0 END)::int AS weekly_high_flags,
  MIN(updated_at) AS first_row_at,
  MAX(updated_at) AS last_row_at
FROM public.league_weekly_points_snapshot
GROUP BY league_id, week_start
ORDER BY week_start DESC, league_id
LIMIT 80;

-- Drill-in: one league + week (replace UUID and date)
-- SELECT *
-- FROM public.league_weekly_points_snapshot
-- WHERE league_id = 'YOUR-LEAGUE-UUID'
--   AND week_start = '2026-05-05'
-- ORDER BY points DESC;

-- Recent weekly-high XP
SELECT id, user_id, delta, reason, idempotency_key, metadata, created_at
FROM public.user_xp_ledger
WHERE reason = 'weekly_high_score'
ORDER BY created_at DESC
LIMIT 50;

-- Recent per-50 combined fantasy points XP
SELECT id, user_id, delta, reason, idempotency_key, metadata, created_at
FROM public.user_xp_ledger
WHERE reason = 'fantasy_points_50'
ORDER BY created_at DESC
LIMIT 30;
