-- Timestamp-based acquisition/release for accurate point attribution.
-- Adds:
-- - acquired_at_ts: effective time this team starts receiving points
-- - released_at_ts: effective time this team stops receiving points
--
-- Backfill rules:
-- - acquired_at_ts defaults to created_at
-- - released_at_ts defaults to released_at at end-of-day UTC

alter table public.league_rosters
  add column if not exists acquired_at_ts timestamptz not null default now();

alter table public.league_rosters
  add column if not exists released_at_ts timestamptz null;

-- Backfill acquired_at_ts from created_at so existing rows reflect when they were inserted.
update public.league_rosters r
set acquired_at_ts = r.created_at
where r.acquired_at_ts is not null;

-- Backfill released_at_ts from released_at date at end-of-day UTC.
-- This keeps legacy date semantics: event_date <= released_at counted.
update public.league_rosters r
set released_at_ts =
  (r.released_at::timestamp at time zone 'UTC') +
  interval '23 hours 59 minutes 59.999 seconds'
where r.released_at is not null
  and r.released_at_ts is null;

