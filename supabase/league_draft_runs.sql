-- Multiple draft runs per league (by year/season). Enables "past drafts" in Draft History.
-- Run after: league_draft_picks, league_draft_order, league_draft_auto_pick_takeover (league_draft_user_state).
-- Backfills one run per league that has picks or order.

-- 1. Create draft runs table (one row per draft event per league)
create table if not exists public.league_draft_runs (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues on delete cascade,
  season_slug text not null default '',
  season_year int not null,
  draft_date date null,
  created_at timestamptz not null default now(),
  unique (league_id, season_slug, season_year)
);
comment on column public.league_draft_runs.season_slug is 'e.g. road-to-summerslam. Empty string = no season (one run per league per year).';

comment on table public.league_draft_runs is 'One row per draft event per league. Enables past drafts by year/season (e.g. 2026 Road to SummerSlam).';
create index if not exists idx_league_draft_runs_league on public.league_draft_runs (league_id);

alter table public.league_draft_runs enable row level security;
create policy "League members can read draft runs"
  on public.league_draft_runs for select to authenticated
  using (public.current_user_is_league_member(league_id));

-- 2. Backfill: one run per league that has picks or order (use league's season_slug and year)
insert into public.league_draft_runs (league_id, season_slug, season_year, draft_date)
select
  l.id,
  coalesce(nullif(trim(l.season_slug), ''), ''),
  coalesce(
    extract(year from l.start_date)::int,
    extract(year from l.draft_date)::int,
    extract(year from l.created_at)::int,
    extract(year from now())::int
  ),
  l.draft_date
from public.leagues l
where exists (
  select 1 from public.league_draft_picks p where p.league_id = l.id
)
   or exists (
  select 1 from public.league_draft_order o where o.league_id = l.id
)
on conflict (league_id, season_slug, season_year) do nothing;

-- 3. Add current_draft_run_id to leagues
alter table public.leagues
  add column if not exists current_draft_run_id uuid null references public.league_draft_runs on delete set null;
comment on column public.leagues.current_draft_run_id is 'Active draft run for this league. Null = legacy single-draft mode.';

update public.leagues l
set current_draft_run_id = r.id
from public.league_draft_runs r
where r.league_id = l.id
  and l.current_draft_run_id is null;

-- 4. league_draft_picks: add draft_run_id, backfill, new PK
alter table public.league_draft_picks
  add column if not exists draft_run_id uuid null references public.league_draft_runs on delete cascade;

update public.league_draft_picks p
set draft_run_id = r.id
from public.league_draft_runs r
where r.league_id = p.league_id and p.draft_run_id is null;

alter table public.league_draft_picks alter column draft_run_id set not null;

alter table public.league_draft_picks drop constraint if exists league_draft_picks_pkey;
create unique index if not exists idx_league_draft_picks_run_pick
  on public.league_draft_picks (draft_run_id, overall_pick);
alter table public.league_draft_picks add primary key (draft_run_id, overall_pick);

create index if not exists idx_league_draft_picks_run on public.league_draft_picks (draft_run_id);

-- 5. league_draft_order: add draft_run_id, backfill, new PK
alter table public.league_draft_order
  add column if not exists draft_run_id uuid null references public.league_draft_runs on delete cascade;

update public.league_draft_order o
set draft_run_id = r.id
from public.league_draft_runs r
where r.league_id = o.league_id and o.draft_run_id is null;

alter table public.league_draft_order alter column draft_run_id set not null;

alter table public.league_draft_order drop constraint if exists league_draft_order_pkey;
create unique index if not exists idx_league_draft_order_run_pick
  on public.league_draft_order (draft_run_id, overall_pick);
alter table public.league_draft_order add primary key (draft_run_id, overall_pick);

create index if not exists idx_league_draft_order_run on public.league_draft_order (draft_run_id);

-- 6. league_draft_user_state: add draft_run_id, backfill, new PK (for leagues that have state)
alter table public.league_draft_user_state
  add column if not exists draft_run_id uuid null references public.league_draft_runs on delete cascade;

update public.league_draft_user_state s
set draft_run_id = r.id
from public.league_draft_runs r
where r.league_id = s.league_id and s.draft_run_id is null;

-- Rows that have no run (league has no run yet) can be deleted or left nullable for now
delete from public.league_draft_user_state where draft_run_id is null;
alter table public.league_draft_user_state alter column draft_run_id set not null;

alter table public.league_draft_user_state drop constraint if exists league_draft_user_state_pkey;
create unique index if not exists idx_league_draft_user_state_run_user
  on public.league_draft_user_state (draft_run_id, user_id);
alter table public.league_draft_user_state add primary key (draft_run_id, user_id);

create index if not exists idx_league_draft_user_state_run on public.league_draft_user_state (draft_run_id);
