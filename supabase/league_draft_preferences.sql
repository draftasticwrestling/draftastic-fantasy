-- Auto-draft preferences: priority list (10-50 wrestlers in order) and strategy flags.
-- One row per user per league. Used when the 2-minute clock expires to auto-pick.

create table if not exists public.league_draft_preferences (
  league_id uuid not null references public.leagues on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  priority_list jsonb not null default '[]'::jsonb,
  strategy text[] not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (league_id, user_id)
);

comment on table public.league_draft_preferences is 'Per-user draft preferences: ordered list of wrestler ids (10-50) and strategy flags for auto-pick.';
comment on column public.league_draft_preferences.priority_list is 'Ordered array of wrestler ids (slug). First available in this list is auto-picked.';
comment on column public.league_draft_preferences.strategy is 'Strategy keys when priority list does not apply: e.g. prioritize_rs, prioritize_ple, balance_brands, prioritize_high_female.';

create index if not exists idx_league_draft_preferences_league on public.league_draft_preferences (league_id);

alter table public.league_draft_preferences enable row level security;

-- Users can read and update their own preferences for leagues they belong to.
create policy "Users can read own draft preferences"
  on public.league_draft_preferences for select
  to authenticated
  using (auth.uid() = user_id and public.current_user_is_league_member(league_id));

create policy "Users can insert own draft preferences"
  on public.league_draft_preferences for insert
  to authenticated
  with check (auth.uid() = user_id and public.current_user_is_league_member(league_id));

create policy "Users can update own draft preferences"
  on public.league_draft_preferences for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
