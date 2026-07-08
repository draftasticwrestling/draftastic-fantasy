-- One-time abandoned-signup re-engagement email tracking.
-- Run in Supabase SQL editor. Safe to re-run.

alter table public.profiles
  add column if not exists abandoned_signup_nudge_sent_at timestamptz null;

comment on column public.profiles.abandoned_signup_nudge_sent_at is
  'When the automated "you were almost there" onboarding email was sent (once per user).';
