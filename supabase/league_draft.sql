/* Draft system: draft style (snake/linear), pick order, and current pick state.
   league_draft_order: one row per pick slot (league_id, overall_pick 1-based, user_id).
   Commissioner generates order; then members make picks in turn (live draft). */

alter table public.leagues
  add column if not exists draft_style text not null default 'snake' check (draft_style in ('snake', 'linear')),
  add column if not exists draft_status text not null default 'not_started' check (draft_status in ('not_started', 'in_progress', 'completed')),
  add column if not exists draft_current_pick int null;

comment on column public.leagues.draft_style is 'snake = reverse order every other round; linear = same order each round.';
comment on column public.leagues.draft_status is 'not_started | in_progress | completed.';
comment on column public.leagues.draft_current_pick is '1-based overall pick number; null when not started or completed.';

create table if not exists public.league_draft_order (
  league_id uuid not null references public.leagues on delete cascade,
  overall_pick int not null check (overall_pick >= 1),
  user_id uuid not null references auth.users on delete cascade,
  primary key (league_id, overall_pick)
);

comment on table public.league_draft_order is 'Pick order for a league draft. overall_pick 1 = first pick, 2 = second, etc.';

create index if not exists idx_league_draft_order_league on public.league_draft_order (league_id);

alter table public.league_draft_order enable row level security;

-- League members can read draft order for their league.
create policy "League members can read draft order"
  on public.league_draft_order for select
  to authenticated
  using (public.current_user_is_league_member(league_id));

-- Only commissioner can insert/update/delete (generate or reset order).
create policy "Commissioner can manage draft order"
  on public.league_draft_order for all
  to authenticated
  using (
    exists (
      select 1 from public.leagues l
      where l.id = league_draft_order.league_id and l.commissioner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.leagues l
      where l.id = league_draft_order.league_id and l.commissioner_id = auth.uid()
    )
  );
