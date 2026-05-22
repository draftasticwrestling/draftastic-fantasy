-- User watchlist: wrestlers flagged to watch, scoped per league.
create table if not exists public.user_watchlist (
  user_id uuid not null references auth.users on delete cascade,
  league_id uuid not null references public.leagues on delete cascade,
  wrestler_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, league_id, wrestler_id)
);

comment on table public.user_watchlist is 'Wrestlers on a user''s watch list for a specific league.';

create index if not exists idx_user_watchlist_user_league on public.user_watchlist (user_id, league_id);

alter table public.user_watchlist enable row level security;

create policy "Users can read own watchlist"
  on public.user_watchlist for select to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own watchlist"
  on public.user_watchlist for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Users can delete own watchlist"
  on public.user_watchlist for delete to authenticated
  using (auth.uid() = user_id);
