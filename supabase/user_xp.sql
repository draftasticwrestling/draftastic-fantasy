-- User experience points (XP) totals, login streak metadata, and append-only ledger.
-- Writes should use the service role from trusted server code (see lib/xp/awardUserXp.ts).

create table if not exists public.user_xp_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  total_xp bigint not null default 0 check (total_xp >= 0),
  login_streak int not null default 0 check (login_streak >= 0),
  last_daily_login date null,
  fantasy_points_tiers_claimed int not null default 0 check (fantasy_points_tiers_claimed >= 0),
  updated_at timestamptz not null default now()
);

comment on table public.user_xp_state is 'Per-user XP total and fields used for streak / fantasy-point milestone awards.';

create table if not exists public.user_xp_ledger (
  id uuid primary key default gen_random_uuid (),
  user_id uuid not null references auth.users (id) on delete cascade,
  delta int not null,
  reason text not null,
  idempotency_key text not null unique,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.user_xp_ledger is 'Append-only XP grants; idempotency_key prevents duplicate awards.';

create index if not exists idx_user_xp_ledger_user_created on public.user_xp_ledger (user_id, created_at desc);

alter table public.user_xp_state enable row level security;
alter table public.user_xp_ledger enable row level security;

drop policy if exists "Users read own xp state" on public.user_xp_state;
create policy "Users read own xp state" on public.user_xp_state for select to authenticated using (auth.uid() = user_id);

drop policy if exists "Users read own xp ledger" on public.user_xp_ledger;
create policy "Users read own xp ledger" on public.user_xp_ledger for select to authenticated using (auth.uid() = user_id);
