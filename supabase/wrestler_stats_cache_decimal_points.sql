-- Wrestler stats cache: store fractional fantasy points (weekly belt holds, partial match scoring).
-- Run in Supabase SQL editor, then refresh cache: npx tsx scripts/recompute-wrestler-stats-cache.ts (or Netlify cron).

alter table public.wrestler_stats_cache
  alter column rs_points type double precision using rs_points::double precision,
  alter column ple_points type double precision using ple_points::double precision,
  alter column belt_points type double precision using belt_points::double precision,
  alter column total_points type double precision using total_points::double precision;
