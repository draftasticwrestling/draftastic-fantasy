-- Auto-pick takeover: track consecutive missed picks and "rest of draft" auto-pick.
-- If a user misses the timer 3 times in a row, system takes over and auto-picks for them (no timer wait) for the remainder of the draft.

-- Mark picks as manual vs auto (for consecutive count and display).
alter table public.league_draft_picks
  add column if not exists is_auto_pick boolean not null default false;

comment on column public.league_draft_picks.is_auto_pick is 'True when the pick was made by the system (timer expired or takeover).';

-- Per-user state during a live draft: consecutive auto-picks and whether system has taken over for the rest of the draft.
create table if not exists public.league_draft_user_state (
  league_id uuid not null references public.leagues on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  consecutive_auto_picks int not null default 0 check (consecutive_auto_picks >= 0),
  auto_pick_rest_of_draft boolean not null default false,
  primary key (league_id, user_id)
);

comment on table public.league_draft_user_state is 'During a live draft: consecutive times this user was auto-picked (reset on manual pick). If consecutive_auto_picks >= 3, auto_pick_rest_of_draft is set and system auto-picks for them immediately for the rest of the draft.';
comment on column public.league_draft_user_state.consecutive_auto_picks is 'Number of consecutive picks that were auto-picks for this user. Reset to 0 when they make a manual pick.';
comment on column public.league_draft_user_state.auto_pick_rest_of_draft is 'If true, system auto-picks for this user immediately when it is their turn (no timer).';

create index if not exists idx_league_draft_user_state_league on public.league_draft_user_state (league_id);

alter table public.league_draft_user_state enable row level security;

-- League members can read state (e.g. to show "system is picking for you"). Writes done via service role (bypasses RLS).
create policy "League members can read draft user state"
  on public.league_draft_user_state for select
  to authenticated
  using (public.current_user_is_league_member(league_id));
