-- Configurable login nudges shown to users after sign-in.

create table if not exists public.site_login_nudges (
  id uuid primary key default gen_random_uuid(),
  nudge_key text not null unique,
  enabled boolean not null default true,
  title text not null,
  body text not null,
  primary_cta_label text null,
  primary_cta_href text null,
  secondary_cta_label text null,
  secondary_cta_href text null,
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint site_login_nudges_key_check
    check (nudge_key in ('missing_draft_prefs', 'no_league_joined'))
);

create index if not exists idx_site_login_nudges_key on public.site_login_nudges(nudge_key);

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
    'missing_draft_prefs',
    true,
    'Set your draft preferences',
    'You still need to save draft preferences in {{missing_count}} of your {{league_count}} league(s).',
    'Set draft preferences',
    '/leagues',
    null,
    null
  ),
  (
    'no_league_joined',
    true,
    'Create or join a league',
    'You''re not in a league yet. Join a public/private league or create your own to get started.',
    'Join a league',
    '/leagues/join',
    'Create a league',
    '/leagues/new'
  )
on conflict (nudge_key) do nothing;
