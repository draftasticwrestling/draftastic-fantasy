/* Add timezone and notification preferences to profiles.
   Run this after profiles.sql if the table already exists. */

alter table public.profiles
  add column if not exists timezone text null,
  add column if not exists notify_trade_proposals boolean not null default true,
  add column if not exists notify_draft_reminder boolean not null default true,
  add column if not exists notify_weekly_results boolean not null default true;

comment on column public.profiles.timezone is 'IANA timezone (e.g. America/New_York) for draft times and weekly windows.';
comment on column public.profiles.notify_trade_proposals is 'Email when another owner proposes a trade.';
comment on column public.profiles.notify_draft_reminder is 'Email before a scheduled draft.';
comment on column public.profiles.notify_weekly_results is 'Email weekly matchup results.';
