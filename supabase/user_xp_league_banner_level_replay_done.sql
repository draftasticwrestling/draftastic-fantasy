-- One-time catch-up: show league home level-up celebration for users who were already level 3+ before replay shipped.

alter table public.user_xp_state
  add column if not exists xp_league_banner_level_replay_done boolean not null default false;

comment on column public.user_xp_state.xp_league_banner_level_replay_done is
  'True after the one-time level-up banner replay for users above level 2 (missed celebration before last_celebrated_level tracking).';
