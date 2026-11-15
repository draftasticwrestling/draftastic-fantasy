-- Live draft lobby: who has the draft page open, and who has marked ready.
-- Members write only their own row. The draft page subscribes to changes
-- instead of reloading the whole draft.

alter table public.leagues drop constraint if exists leagues_draft_type_check;
alter table public.leagues
  add constraint leagues_draft_type_check
  check (
    draft_type is null
    or draft_type in ('offline', 'linear', 'snake', 'autopick', 'salary_cap', 'live')
  );

create table if not exists public.league_draft_lobby (
  league_id uuid not null references public.leagues (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  is_ready boolean not null default false,
  last_seen_at timestamptz not null default now(),
  primary key (league_id, user_id)
);

comment on table public.league_draft_lobby is
  'Presence for a private live draft. last_seen_at is refreshed while the draft page is open. is_ready is the manager''s explicit ready toggle.';

alter table public.league_draft_lobby enable row level security;

drop policy if exists "League members can read draft lobby" on public.league_draft_lobby;
create policy "League members can read draft lobby"
  on public.league_draft_lobby for select
  to authenticated
  using (public.current_user_is_league_member(league_id));

drop policy if exists "League members insert own draft lobby row" on public.league_draft_lobby;
create policy "League members insert own draft lobby row"
  on public.league_draft_lobby for insert
  to authenticated
  with check (auth.uid() = user_id and public.current_user_is_league_member(league_id));

drop policy if exists "League members update own draft lobby row" on public.league_draft_lobby;
create policy "League members update own draft lobby row"
  on public.league_draft_lobby for update
  to authenticated
  using (auth.uid() = user_id and public.current_user_is_league_member(league_id))
  with check (auth.uid() = user_id and public.current_user_is_league_member(league_id));

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'league_draft_lobby'
  ) then
    alter publication supabase_realtime add table public.league_draft_lobby;
  end if;
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'league_draft_picks'
  ) then
    alter publication supabase_realtime add table public.league_draft_picks;
  end if;
end $$;
