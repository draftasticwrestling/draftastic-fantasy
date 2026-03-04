-- Ensure league_draft_preferences table exists (with priority_list). Safe to run if table is missing or already exists.

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

-- Policies (drop first so this migration is re-runnable; then create)
drop policy if exists "Users can read own draft preferences" on public.league_draft_preferences;
drop policy if exists "Users can insert own draft preferences" on public.league_draft_preferences;
drop policy if exists "Users can update own draft preferences" on public.league_draft_preferences;

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

-- Add priority_list if table existed from an older schema without it
alter table public.league_draft_preferences
  add column if not exists priority_list jsonb not null default '[]'::jsonb;

-- Add strategy_options if not present
alter table public.league_draft_preferences
  add column if not exists strategy_options jsonb null;

comment on column public.league_draft_preferences.strategy_options is 'Optional: { focus: "2026"|"2025"|"all", pointStrategy: "total"|"rs"|"ple"|"belt", wrestlerStrategy: "best_available"|"balanced_gender"|"balanced_brands"|"high_males"|"high_females" }. When set, auto-pick uses these instead of strategy[].';
