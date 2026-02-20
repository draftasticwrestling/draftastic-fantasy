/* Commissioner manual roster input: assign wrestlers to league members.
   wrestler_id matches wrestlers.id (text). Optional contract (e.g. "3 yr", "2 yr", "1 yr"). */

create table if not exists public.league_rosters (
  league_id uuid not null references public.leagues on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  wrestler_id text not null,
  contract text null,
  created_at timestamptz not null default now(),
  primary key (league_id, user_id, wrestler_id)
);

comment on table public.league_rosters is 'Roster assignments per league member (commissioner manual input). wrestler_id = wrestlers.id.';

create index if not exists idx_league_rosters_league_user
  on public.league_rosters (league_id, user_id);

alter table public.league_rosters enable row level security;

-- League members can read rosters for their league.
create policy "League members can read rosters"
  on public.league_rosters for select
  to authenticated
  using (public.current_user_is_league_member(league_id));

-- Only commissioner can insert (and only for members of their league).
create policy "Commissioner can add roster entry"
  on public.league_rosters for insert
  to authenticated
  with check (
    exists (
      select 1 from public.leagues l
      where l.id = league_rosters.league_id and l.commissioner_id = auth.uid()
    )
    and exists (
      select 1 from public.league_members m
      where m.league_id = league_rosters.league_id and m.user_id = league_rosters.user_id
    )
  );

-- Only commissioner can delete roster entries.
create policy "Commissioner can remove roster entry"
  on public.league_rosters for delete
  to authenticated
  using (
    exists (
      select 1 from public.leagues l
      where l.id = league_rosters.league_id and l.commissioner_id = auth.uid()
    )
  );

-- Commissioner can update (e.g. contract).
create policy "Commissioner can update roster entry"
  on public.league_rosters for update
  to authenticated
  using (
    exists (
      select 1 from public.leagues l
      where l.id = league_rosters.league_id and l.commissioner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.leagues l
      where l.id = league_rosters.league_id and l.commissioner_id = auth.uid()
    )
  );
