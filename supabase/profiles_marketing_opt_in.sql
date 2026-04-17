/* Add explicit marketing consent fields for signup/account preferences. */

alter table public.profiles
  add column if not exists marketing_opt_in boolean not null default false,
  add column if not exists marketing_opt_in_at timestamptz null,
  add column if not exists marketing_opt_in_source text null;

comment on column public.profiles.marketing_opt_in is 'True when user explicitly opted into marketing emails.';
comment on column public.profiles.marketing_opt_in_at is 'Timestamp of latest explicit marketing opt-in.';
comment on column public.profiles.marketing_opt_in_source is 'Where opt-in was captured (signup_email, signup_google, account_settings, etc.).';
