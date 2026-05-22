-- Scope user watchlists per league (was global user_id + wrestler_id).
-- Existing rows cannot be attributed to a league; clear them before enforcing NOT NULL.

alter table public.user_watchlist
  add column if not exists league_id uuid references public.leagues (id) on delete cascade;

delete from public.user_watchlist where league_id is null;

alter table public.user_watchlist
  alter column league_id set not null;

alter table public.user_watchlist drop constraint if exists user_watchlist_pkey;

alter table public.user_watchlist
  add primary key (user_id, league_id, wrestler_id);

drop index if exists idx_user_watchlist_user;

create index if not exists idx_user_watchlist_user_league
  on public.user_watchlist (user_id, league_id);

comment on table public.user_watchlist is 'Wrestlers on a user''s watch list for a specific league.';
