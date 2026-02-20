-- Fix: "infinite recursion detected in policy for relation league_members"
-- Run this in the Supabase SQL editor. It adds a helper and updates the policies.

create or replace function public.current_user_is_league_member(p_league_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.league_members
    where league_id = p_league_id and user_id = auth.uid()
  );
$$;

drop policy if exists "League members can read members" on public.league_members;
create policy "League members can read members"
  on public.league_members for select
  to authenticated
  using (public.current_user_is_league_member(league_id));

drop policy if exists "League members can read invites" on public.league_invites;
create policy "League members can read invites"
  on public.league_invites for select
  to authenticated
  using (public.current_user_is_league_member(league_id));

-- Fix: allow league creation when session is present (avoids 'new row violates RLS for leagues').
drop policy if exists "Authenticated can create league" on public.leagues;
create policy "Authenticated can create league"
  on public.leagues for insert
  to authenticated
  with check (true);
