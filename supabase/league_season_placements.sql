-- Durable league season placements (1st = champion). Used by hub Champions box and /account belts.
-- Writes via service role / finalize script only.

create table if not exists public.league_season_placements (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  season_key text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  placement int not null check (placement >= 1),
  points numeric not null default 0,
  determined_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

comment on table public.league_season_placements is
  'Finalized season placements (champion = placement 1). Source of truth for hub Champions and account belts.';

alter table public.league_season_placements
  drop constraint if exists league_season_placements_league_season_place_key;
alter table public.league_season_placements
  add constraint league_season_placements_league_season_place_key
  unique (league_id, season_key, placement);

alter table public.league_season_placements
  drop constraint if exists league_season_placements_league_season_user_key;
alter table public.league_season_placements
  add constraint league_season_placements_league_season_user_key
  unique (league_id, season_key, user_id);

create index if not exists league_season_placements_season_place_idx
  on public.league_season_placements (season_key, placement);

create index if not exists league_season_placements_user_place_idx
  on public.league_season_placements (user_id, placement);

alter table public.league_season_placements enable row level security;

drop policy if exists "Authenticated read league season placements" on public.league_season_placements;
create policy "Authenticated read league season placements"
  on public.league_season_placements
  for select
  to authenticated
  using (true);
