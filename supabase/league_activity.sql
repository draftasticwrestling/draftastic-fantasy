-- Log roster activity (drops and free agent signings) for Recent Activity feed.
-- Trades come from league_trade_proposals; this table is for drop/fa_add only.

create table if not exists public.league_activity (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues on delete cascade,
  activity_type text not null check (activity_type in ('drop', 'fa_add')),
  user_id uuid not null references auth.users on delete cascade,
  wrestler_id text not null,
  secondary_wrestler_id text null,
  created_at timestamptz not null default now()
);

comment on table public.league_activity is 'Recent roster activity: drops and free agent signings for league feed.';
comment on column public.league_activity.secondary_wrestler_id is 'For fa_add: wrestler dropped to make room. For drop: null.';

create index if not exists idx_league_activity_league_created
  on public.league_activity (league_id, created_at desc);

alter table public.league_activity enable row level security;

create policy "League members can read league activity"
  on public.league_activity for select
  to authenticated
  using (public.current_user_is_league_member(league_id));

-- Inserts are done via service role in app (no insert policy for users).
