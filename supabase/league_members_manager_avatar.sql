-- Per-league manager avatar (overrides profiles.avatar_url for that league's UI).
-- Run in Supabase SQL Editor after league_members exists.

alter table public.league_members
  add column if not exists manager_avatar_url text null;

comment on column public.league_members.manager_avatar_url is
  'Public storage URL for this member''s avatar in this league; null uses profiles.avatar_url in UI.';
