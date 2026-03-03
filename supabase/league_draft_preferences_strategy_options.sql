-- Add strategy_options for focus + point strategy + wrestler strategy (replaces strategy text[] usage when set).
alter table public.league_draft_preferences
  add column if not exists strategy_options jsonb null;

comment on column public.league_draft_preferences.strategy_options is 'Optional: { focus: "2026"|"2025"|"all", pointStrategy: "total"|"rs"|"ple"|"belt", wrestlerStrategy: "best_available"|"balanced_gender"|"balanced_brands"|"high_males"|"high_females" }. When set, auto-pick uses these instead of strategy[].';

