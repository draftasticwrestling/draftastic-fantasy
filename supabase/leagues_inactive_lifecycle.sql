-- Private-league inactivity: underfilled / never-drafted shells after 2 weeks.

alter table public.leagues
  add column if not exists is_inactive boolean not null default false,
  add column if not exists inactivated_at timestamptz null;

create index if not exists idx_leagues_is_inactive on public.leagues (is_inactive)
  where is_inactive = true;

comment on column public.leagues.is_inactive is
  'True when a private league stalled (too few owners or draft never completed) and was marked inactive after the grace period.';
comment on column public.leagues.inactivated_at is
  'UTC timestamp when the league was marked inactive.';
