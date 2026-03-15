-- Store draft time separately so it persists (draft_date column is DATE and drops time).
-- draft_time: "HH:MM" or "HH:MM:SS" from HTML time input; use when showing "Begin draft" gating.

alter table public.leagues
  add column if not exists draft_time text null;

comment on column public.leagues.draft_time is 'Time of day for scheduled draft (e.g. 14:30). Combined with draft_date for live draft gating.';
