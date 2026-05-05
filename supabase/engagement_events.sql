-- Engagement telemetry for site-admin seasonal analytics.

create table if not exists public.engagement_events (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  user_id uuid null references auth.users(id) on delete set null,
  league_id uuid null references public.leagues(id) on delete set null,
  season_slug text null,
  event_name text not null,
  path text null,
  metadata jsonb not null default '{}'::jsonb
);

comment on table public.engagement_events is 'Append-only product engagement events (sign-ins, roster moves, feature page views, sessions).';
comment on column public.engagement_events.event_name is 'Stable event key (auth.sign_in, league.fa_add, page.logged_in_view, etc.).';

create index if not exists idx_engagement_events_time on public.engagement_events (occurred_at desc);
create index if not exists idx_engagement_events_event_time on public.engagement_events (event_name, occurred_at desc);
create index if not exists idx_engagement_events_season_time on public.engagement_events (season_slug, occurred_at desc);
create index if not exists idx_engagement_events_user_time on public.engagement_events (user_id, occurred_at desc);
create index if not exists idx_engagement_events_league_time on public.engagement_events (league_id, occurred_at desc);

alter table public.engagement_events enable row level security;

drop policy if exists "Users can insert own engagement events" on public.engagement_events;
create policy "Users can insert own engagement events"
  on public.engagement_events for insert
  to authenticated
  with check (user_id = auth.uid());
