-- Owner features: lineups (active wrestlers per event), trade/release/free-agent proposals.

-- Lineup: which wrestlers count for scoring at a specific event (owner chooses active up to ACTIVE_PER_EVENT).
create table if not exists public.league_lineups (
  league_id uuid not null references public.leagues on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  event_id text not null,
  wrestler_id text not null,
  created_at timestamptz not null default now(),
  primary key (league_id, user_id, event_id, wrestler_id)
);

comment on table public.league_lineups is 'Active lineup per owner per event; wrestlers not listed are benched.';

create index if not exists idx_league_lineups_league_user_event
  on public.league_lineups (league_id, user_id, event_id);

alter table public.league_lineups enable row level security;

create policy "League members can read lineups"
  on public.league_lineups for select to authenticated
  using (public.current_user_is_league_member(league_id));

create policy "Owners can manage own lineup"
  on public.league_lineups for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Trade proposals: owner A proposes trading with owner B.
create table if not exists public.league_trade_proposals (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues on delete cascade,
  from_user_id uuid not null references auth.users on delete cascade,
  to_user_id uuid not null references auth.users on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  responded_at timestamptz null
);

create table if not exists public.league_trade_proposal_items (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.league_trade_proposals on delete cascade,
  wrestler_id text not null,
  direction text not null check (direction in ('give', 'receive'))
  -- give = from from_user_id to to_user_id; receive = from to_user_id to from_user_id
);

create index if not exists idx_league_trade_proposals_league on public.league_trade_proposals (league_id);
alter table public.league_trade_proposals enable row level security;
create policy "League members can read trade proposals"
  on public.league_trade_proposals for select to authenticated
  using (public.current_user_is_league_member(league_id));
create policy "League members can insert trade proposals (as from_user)"
  on public.league_trade_proposals for insert to authenticated
  with check (auth.uid() = from_user_id and public.current_user_is_league_member(league_id));
create policy "Commissioner or to_user can update (accept/reject)"
  on public.league_trade_proposals for update to authenticated
  using (
    public.current_user_is_league_member(league_id)
    and (auth.uid() = to_user_id or exists (select 1 from public.leagues l where l.id = league_id and l.commissioner_id = auth.uid()))
  );

alter table public.league_trade_proposal_items enable row level security;
create policy "League members can read trade items"
  on public.league_trade_proposal_items for select to authenticated
  using (exists (
    select 1 from public.league_trade_proposals p
    where p.id = proposal_id and public.current_user_is_league_member(p.league_id)
  ));
create policy "League members can insert trade items (for own proposal)"
  on public.league_trade_proposal_items for insert to authenticated
  with check (exists (
    select 1 from public.league_trade_proposals p
    where p.id = proposal_id and p.from_user_id = auth.uid()
  ));

-- Release proposals: owner requests to drop a wrestler (commissioner approves).
create table if not exists public.league_release_proposals (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  wrestler_id text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  responded_at timestamptz null
);

create index if not exists idx_league_release_proposals_league on public.league_release_proposals (league_id);
alter table public.league_release_proposals enable row level security;
create policy "League members can read release proposals"
  on public.league_release_proposals for select to authenticated
  using (public.current_user_is_league_member(league_id));
create policy "Owners can create release proposal for own roster"
  on public.league_release_proposals for insert to authenticated
  with check (auth.uid() = user_id and public.current_user_is_league_member(league_id));
create policy "Commissioner can update release proposals"
  on public.league_release_proposals for update to authenticated
  using (exists (select 1 from public.leagues l where l.id = league_id and l.commissioner_id = auth.uid()));

-- Free agent proposals: owner requests to add a wrestler (optional: drop one to make room).
create table if not exists public.league_free_agent_proposals (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  wrestler_id text not null,
  drop_wrestler_id text null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  responded_at timestamptz null
);

create index if not exists idx_league_fa_proposals_league on public.league_free_agent_proposals (league_id);
alter table public.league_free_agent_proposals enable row level security;
create policy "League members can read FA proposals"
  on public.league_free_agent_proposals for select to authenticated
  using (public.current_user_is_league_member(league_id));
create policy "Owners can create FA proposal"
  on public.league_free_agent_proposals for insert to authenticated
  with check (auth.uid() = user_id and public.current_user_is_league_member(league_id));
create policy "Commissioner can update FA proposals"
  on public.league_free_agent_proposals for update to authenticated
  using (exists (select 1 from public.leagues l where l.id = league_id and l.commissioner_id = auth.uid()));
