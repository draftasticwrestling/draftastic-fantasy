-- Timezone for the GM-set draft clock (IANA, same list as profile timezones).
-- draft_date + draft_time stay the civil date and clock the GM typed.
-- When draft_timezone is null, older rows keep the previous server-local interpretation.

alter table public.leagues
  add column if not exists draft_timezone text null;

comment on column public.leagues.draft_timezone is
  'IANA timezone for draft_time (e.g. America/Los_Angeles). Null on rows saved before this column existed.';
