-- Editable team name per member (display in standings; default to profile display_name).
-- Required for Edit Team Info to work. Run in Supabase SQL Editor if you see
-- "Could not find the 'team_name' column of 'league_members' in the schema cache".

alter table public.league_members
  add column if not exists team_name text null;

comment on column public.league_members.team_name is 'Owner-editable team name for this league; falls back to profile display_name.';

-- Owners can update their own team_name only (idempotent: drop first).
drop policy if exists "Member can update own team_name" on public.league_members;
create policy "Member can update own team_name"
  on public.league_members for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
