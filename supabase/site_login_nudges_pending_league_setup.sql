-- Login nudge for users who joined a public salary-cap league but have not finished roster setup.

alter table public.site_login_nudges drop constraint if exists site_login_nudges_key_check;

alter table public.site_login_nudges
  add constraint site_login_nudges_key_check
  check (nudge_key in ('missing_draft_prefs', 'no_league_joined', 'pending_league_setup'));

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
values
  (
    'pending_league_setup',
    true,
    'Finish your league setup',
    'You joined {{league_name}} but haven''t finished roster setup yet. Build your roster and complete setup before Monday so you keep your spot.',
    'Complete setup',
    '/leagues',
    null,
    null
  )
on conflict (nudge_key) do nothing;
