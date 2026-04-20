-- Admin archive metadata + helper indexes for league lifecycle operations.

alter table public.leagues
  add column if not exists is_archived boolean not null default false,
  add column if not exists archived_at timestamptz null,
  add column if not exists archived_by uuid null references auth.users(id) on delete set null,
  add column if not exists archive_reason text null;

create index if not exists idx_leagues_is_archived on public.leagues (is_archived);

comment on column public.leagues.is_archived is 'True when league is archived and hidden from standard user league lists.';
comment on column public.leagues.archived_at is 'UTC timestamp when archived.';
comment on column public.leagues.archived_by is 'Admin user id that archived the league.';
comment on column public.leagues.archive_reason is 'Optional admin note describing why the league was archived.';
