-- One-time league home XP banner intro + throttle stamp for fantasy-points tier full checks.

alter table public.user_xp_state
  add column if not exists xp_league_banner_intro_seen boolean not null default false;

alter table public.user_xp_state
  add column if not exists fantasy_pts_tier_last_full_check_at timestamptz null;

comment on column public.user_xp_state.xp_league_banner_intro_seen is 'After user dismisses the rollout intro banner on league home; suppresses repeat intro.';
comment on column public.user_xp_state.fantasy_pts_tier_last_full_check_at is 'Last time a full cross-league fantasy-points tier pass ran for this user; used to throttle work.';
