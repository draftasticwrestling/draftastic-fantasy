-- Draft pick history (who picked which wrestler) and timer for 2-minute auto-pick.

alter table public.leagues
  add column if not exists draft_current_pick_started_at timestamptz null;

comment on column public.leagues.draft_current_pick_started_at is 'When the current pick started; used for 2-minute auto-pick deadline.';

create table if not exists public.league_draft_picks (
  league_id uuid not null references public.leagues on delete cascade,
  overall_pick int not null check (overall_pick >= 1),
  user_id uuid not null references auth.users on delete cascade,
  wrestler_id text not null,
  picked_at timestamptz not null default now(),
  primary key (league_id, overall_pick)
);

comment on table public.league_draft_picks is 'History of draft picks: who was picked at each slot.';

create index if not exists idx_league_draft_picks_league on public.league_draft_picks (league_id);

alter table public.league_draft_picks enable row level security;

create policy "League members can read draft picks"
  on public.league_draft_picks for select
  to authenticated
  using (public.current_user_is_league_member(league_id));

-- Only server (service role) or commissioner can insert (picks are made via makeDraftPick / auto-pick).
create policy "Commissioner can insert draft picks"
  on public.league_draft_picks for insert
  to authenticated
  with check (
    exists (
      select 1 from public.leagues l
      where l.id = league_draft_picks.league_id and l.commissioner_id = auth.uid()
    )
  );
