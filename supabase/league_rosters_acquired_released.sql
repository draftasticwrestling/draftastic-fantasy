-- Acquisition/release dates for fair scoring:
-- Points count only when event_date >= acquired_at and (released_at is null or event_date <= released_at).
-- Supports re-adds: multiple rows per (league, user, wrestler) with one "active" (released_at is null).

-- 1. Add new columns
alter table public.league_rosters
  add column if not exists id uuid not null default gen_random_uuid(),
  add column if not exists acquired_at date,
  add column if not exists released_at date;

-- 2. Backfill acquired_at for existing rows (before we set not null)
update public.league_rosters r
set acquired_at = coalesce(
  (select (l.draft_date)::date from public.leagues l where l.id = r.league_id),
  (select (l.start_date)::date from public.leagues l where l.id = r.league_id),
  (r.created_at at time zone 'UTC')::date
)
where r.acquired_at is null;

-- 3. Set not null and default for future inserts
alter table public.league_rosters
  alter column acquired_at set not null,
  alter column acquired_at set default current_date;

comment on column public.league_rosters.acquired_at is 'First date this owner gets points for this wrestler (event_date >= acquired_at).';
comment on column public.league_rosters.released_at is 'Last date points count (event_date <= released_at). NULL = still on roster.';

-- 4. Replace composite PK with id as PK (allows multiple stints for same wrestler)
alter table public.league_rosters drop constraint if exists league_rosters_pkey;
alter table public.league_rosters add primary key (id);

-- 5. Only one active row per (league, user, wrestler)
create unique index if not exists idx_league_rosters_active_unique
  on public.league_rosters (league_id, user_id, wrestler_id)
  where (released_at is null);
