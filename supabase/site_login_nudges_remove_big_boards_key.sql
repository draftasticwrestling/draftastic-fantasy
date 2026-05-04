-- Remove retired Big Boards login nudge (app no longer reads this key).
delete from public.site_login_nudges where nudge_key = 'big_boards_updated';

alter table public.site_login_nudges drop constraint if exists site_login_nudges_key_check;

alter table public.site_login_nudges
  add constraint site_login_nudges_key_check
  check (nudge_key in ('missing_draft_prefs', 'no_league_joined'));
