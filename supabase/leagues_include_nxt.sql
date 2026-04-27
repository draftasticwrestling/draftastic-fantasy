-- NXT-inclusive leagues (admin-gated in app; default false for all existing rows).
alter table public.leagues
  add column if not exists include_nxt boolean not null default false;

comment on column public.leagues.include_nxt is
  'When true, NXT roster/events count toward fantasy scoring and draft pools for this league.';
