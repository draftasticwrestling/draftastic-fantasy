-- Add global "big boards updated" login nudge key and seed default message.

alter table public.site_login_nudges
  drop constraint if exists site_login_nudges_key_check;

alter table public.site_login_nudges
  add constraint site_login_nudges_key_check
  check (nudge_key in ('missing_draft_prefs', 'no_league_joined', 'big_boards_updated'));

insert into public.site_login_nudges (
  nudge_key,
  enabled,
  title,
  body,
  primary_cta_label,
  primary_cta_href,
  secondary_cta_label,
  secondary_cta_href
)
values (
  'big_boards_updated',
  true,
  'BIG BOARDS UPDATED',
  'Much has changed since WrestleMania, with releases and call ups, so our Big Boards have changed as well! Check out the updates and make sure you like your draft order. Drafts begin May 1st!',
  null,
  null,
  null,
  null
)
on conflict (nudge_key) do update set
  enabled = excluded.enabled,
  title = excluded.title,
  body = excluded.body,
  primary_cta_label = excluded.primary_cta_label,
  primary_cta_href = excluded.primary_cta_href,
  secondary_cta_label = excluded.secondary_cta_label,
  secondary_cta_href = excluded.secondary_cta_href,
  updated_at = now();
