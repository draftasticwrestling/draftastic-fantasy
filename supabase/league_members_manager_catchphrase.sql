-- Per-league manager catchphrase (short tagline; unique per league, case-insensitive).
-- Run in Supabase SQL Editor after league_members exists.

alter table public.league_members
  add column if not exists manager_catchphrase text null;

comment on column public.league_members.manager_catchphrase is
  'Optional short tagline for this manager in this league; must be unique per league (case-insensitive) among non-null values.';

-- One non-empty catchphrase per league (case-insensitive); multiple NULLs allowed.
create unique index if not exists league_members_league_catchphrase_ci_unique
  on public.league_members (league_id, lower(btrim(manager_catchphrase)))
  where manager_catchphrase is not null and btrim(manager_catchphrase) <> '';
