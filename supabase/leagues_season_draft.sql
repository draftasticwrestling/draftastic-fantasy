-- Add season and draft date to leagues. Season defines the window; draft_date (optional)
-- means points start at first event after draft (for leagues started after season begin).

alter table public.leagues
  add column if not exists season_slug text null,
  add column if not exists draft_date date null;

comment on column public.leagues.season_slug is 'Standard season: road-to-summerslam, road-to-survivor-series, road-to-wrestlemania, chamber-to-mania.';
comment on column public.leagues.draft_date is 'When set, league starts counting points at first event after this date (for late-start leagues).';
