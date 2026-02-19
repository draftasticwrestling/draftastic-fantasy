/* Discovery holdings: owner uses a discovery pick to hold rights to a wrestler (any company).
   When that wrestler debuts on WWE main roster, a 12-month clock starts.
   Owner must activate (add to roster) within 12 months or rights expire and wrestler becomes a free agent.
   Wrestlers may not be in the database yet. */

alter table draft_picks add column if not exists used_at timestamptz null;
comment on column draft_picks.used_at is 'When this pick was used (e.g. for a discovery holding). Null = still available.';

create table if not exists discovery_holdings (
  id uuid primary key default gen_random_uuid(),
  league_slug text not null,
  owner_slug text not null,
  draft_pick_id uuid not null references draft_picks(id),
  wrestler_name text not null,
  company text null,
  debut_date date null,
  activated_at timestamptz null,
  created_at timestamptz default now(),
  unique (draft_pick_id)
);

create index if not exists idx_discovery_holdings_league_owner
  on discovery_holdings (league_slug, owner_slug);

comment on table discovery_holdings is 'Rights to a wrestler from any company. debut_date = WWE MR debut (starts 12-mo clock). activated_at = added to roster; null and past 12 mo = expired.';

/* Allow app (anon) to read and write discovery_holdings. */
alter table discovery_holdings enable row level security;
drop policy if exists "Allow read discovery_holdings" on discovery_holdings;
create policy "Allow read discovery_holdings" on discovery_holdings for select using (true);
drop policy if exists "Allow insert discovery_holdings" on discovery_holdings;
create policy "Allow insert discovery_holdings" on discovery_holdings for insert with check (true);
drop policy if exists "Allow update discovery_holdings" on discovery_holdings;
create policy "Allow update discovery_holdings" on discovery_holdings for update using (true);
