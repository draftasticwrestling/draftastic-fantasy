create table if not exists public.league_weekly_points_snapshot (
  league_id uuid not null references public.leagues (id) on delete cascade,
  week_start date not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  points numeric not null default 0,
  rank int not null default 0,
  is_weekly_high boolean not null default false,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (league_id, week_start, user_id)
);

create index if not exists idx_league_weekly_points_snapshot_league_week
  on public.league_weekly_points_snapshot (league_id, week_start desc);

create index if not exists idx_league_weekly_points_snapshot_user_week
  on public.league_weekly_points_snapshot (user_id, week_start desc);

comment on table public.league_weekly_points_snapshot is
  'Weekly per-user points snapshots used for league weekly/season leaderboards and XP weekly-high audits.';
