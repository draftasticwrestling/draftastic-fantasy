-- Draft settings: type (offline/linear/snake/autopick), time per pick, draft order method.
-- Run in Supabase SQL Editor (or psql).

alter table public.leagues
  add column if not exists draft_type text null check (draft_type is null or draft_type in ('offline', 'linear', 'snake', 'autopick')),
  add column if not exists time_per_pick_seconds int null default 120 check (time_per_pick_seconds is null or time_per_pick_seconds in (30, 60, 90, 120, 150, 180)),
  add column if not exists draft_order_method text null default 'random_one_hour_before' check (draft_order_method is null or draft_order_method in ('random_one_hour_before', 'manual_by_gm'));

comment on column public.leagues.draft_type is 'offline | linear | snake | autopick. If null, legacy draft_style (snake/linear) is used.';
comment on column public.leagues.time_per_pick_seconds is 'Seconds per pick in live draft: 30, 60, 90, 120, 150, 180. Default 120.';
comment on column public.leagues.draft_order_method is 'random_one_hour_before | manual_by_gm.';

-- Backfill draft_type from draft_style where draft_type is null
update public.leagues
set draft_type = coalesce(draft_style, 'snake')
where draft_type is null;
