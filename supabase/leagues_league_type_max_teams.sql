-- League format and size. Optional; existing leagues remain null.
alter table public.leagues
  add column if not exists league_type text null,
  add column if not exists max_teams int null;

comment on column public.leagues.league_type is 'Format: season_overall, head_to_head, legacy.';
comment on column public.leagues.max_teams is 'Maximum number of teams (e.g. 3–12).';
