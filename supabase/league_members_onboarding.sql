-- Per-league manager onboarding (faction profile + draft prefs / salary cap roster).

alter table public.league_members
  add column if not exists onboarding_completed_at timestamptz null;

comment on column public.league_members.onboarding_completed_at is
  'When set, this member finished league onboarding (faction setup + draft prefs or salary cap intro) for that league.';
