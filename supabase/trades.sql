/* Trades: date and legs (wrestlers and/or draft picks moving between owners).
   When a trade is recorded, roster_assignments and draft_picks are updated to match. */

create table if not exists trades (
  id uuid primary key default gen_random_uuid(),
  league_slug text not null,
  trade_date date not null,
  notes text,
  created_at timestamptz default now()
);

create table if not exists trade_legs (
  id uuid primary key default gen_random_uuid(),
  trade_id uuid not null references trades(id) on delete cascade,
  from_owner_slug text not null,
  to_owner_slug text not null,
  wrestler_id text,
  draft_pick_id uuid references draft_picks(id),
  constraint trade_leg_asset check (
    (wrestler_id is not null and draft_pick_id is null) or
    (wrestler_id is null and draft_pick_id is not null)
  )
);

create index if not exists idx_trades_league_date on trades (league_slug, trade_date desc);
create index if not exists idx_trade_legs_trade_id on trade_legs (trade_id);

comment on table trades is 'Record of trades; legs describe each wrestler or draft pick moving from one owner to another.';
