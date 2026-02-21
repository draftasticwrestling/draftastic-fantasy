-- Editable team name per member (display in standings; default to profile display_name).

alter table public.league_members
  add column if not exists team_name text null;

comment on column public.league_members.team_name is 'Owner-editable team name for this league; falls back to profile display_name.';

-- Owners can update their own team_name only.
create policy "Member can update own team_name"
  on public.league_members for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
