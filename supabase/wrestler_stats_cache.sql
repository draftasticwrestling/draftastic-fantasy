-- Aggregated wrestler stats cache to reduce repeated heavy reads of events.matches.
-- Run once in Supabase SQL editor, then refresh via scripts/recompute-wrestler-stats-cache.ts.

create table if not exists public.wrestler_stats_cache (
  season_key text not null check (season_key in ('all_time', '2025', '2026')),
  wrestler_id text not null,
  rs_points integer not null default 0,
  ple_points integer not null default 0,
  belt_points integer not null default 0,
  total_points integer not null default 0,
  mw integer not null default 0,
  win integer not null default 0,
  loss integer not null default 0,
  nc integer not null default 0,
  dqw integer not null default 0,
  dql integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (season_key, wrestler_id)
);

create index if not exists wrestler_stats_cache_wrestler_idx
  on public.wrestler_stats_cache (wrestler_id);

alter table public.wrestler_stats_cache enable row level security;

drop policy if exists "Public read wrestler stats cache" on public.wrestler_stats_cache;
create policy "Public read wrestler stats cache"
  on public.wrestler_stats_cache
  for select
  using (true);

