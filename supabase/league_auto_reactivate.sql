-- Allow league to renew automatically for a new season.
alter table public.leagues
  add column if not exists auto_reactivate boolean not null default false;

comment on column public.leagues.auto_reactivate is 'If true, league can be renewed automatically for a new season.';
