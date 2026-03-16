-- League Manager Note: optional text shown on the league overview, editable by commissioner.
alter table public.leagues add column if not exists manager_note text null;
comment on column public.leagues.manager_note is 'Optional note from the league commissioner shown to all members on the league overview.';
