-- Deprecated as a separate step: this file now matches league_activity.sql.
-- Run the full script below once in Supabase SQL Editor (creates table if missing + all policies).

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

drop policy if exists "League members can read league activity" on public.league_activity;
create policy "League members can read league activity"
  on public.league_activity for select
  to authenticated
  using (public.current_user_is_league_member(league_id));

drop policy if exists "Members can insert own league roster activity" on public.league_activity;
create policy "Members can insert own league roster activity"
  on public.league_activity for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and activity_type in ('drop', 'fa_add')
    and public.current_user_is_league_member(league_id)
  );

drop policy if exists "GM can insert league roster activity for members" on public.league_activity;
create policy "GM can insert league roster activity for members"
  on public.league_activity for insert
  to authenticated
  with check (
    activity_type in ('drop', 'fa_add')
    and exists (
      select 1 from public.leagues l
      where l.id = league_id and l.commissioner_id = auth.uid()
    )
    and exists (
      select 1 from public.league_members m
      where m.league_id = league_activity.league_id
        and m.user_id = league_activity.user_id
    )
  );
