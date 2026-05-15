-- Last XP level celebrated on league home (level-up banner dismissed or intro synced).

alter table public.user_xp_state
  add column if not exists xp_league_banner_last_celebrated_level integer null;

comment on column public.user_xp_state.xp_league_banner_last_celebrated_level is
  'Highest XP level for which the league home level-up banner was shown and dismissed; null until first sync after intro.';
