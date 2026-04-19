-- Public vs private league metadata and quick-join RPC.

alter table public.leagues
  add column if not exists visibility_type text not null default 'private',
  add column if not exists public_status text null,
  add column if not exists public_sequence int null;

alter table public.leagues
  drop constraint if exists leagues_visibility_type_check;

alter table public.leagues
  add constraint leagues_visibility_type_check
  check (visibility_type in ('private', 'public'));

alter table public.leagues
  drop constraint if exists leagues_public_status_check;

alter table public.leagues
  add constraint leagues_public_status_check
  check (public_status is null or public_status in ('open', 'full', 'awaiting_minimum', 'active'));

create unique index if not exists idx_leagues_public_sequence_unique
  on public.leagues (public_sequence)
  where visibility_type = 'public' and public_sequence is not null;

comment on column public.leagues.visibility_type is 'League visibility: private (invite/code) or public (auto-assigned queue).';
comment on column public.leagues.public_status is 'Public lifecycle: open, full, awaiting_minimum, active.';
comment on column public.leagues.public_sequence is 'Canonical sequence used for generated public names (e.g. R2Summer 12).';

create or replace function public.join_oldest_public_league()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
  v_league public.leagues;
  v_count int;
  v_status text;
begin
  v_uid := auth.uid();
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'Not authenticated');
  end if;

  -- If already in a public league that is still in pre-draft states, return it.
  select l.*
  into v_league
  from public.leagues l
  join public.league_members m on m.league_id = l.id
  where m.user_id = v_uid
    and l.visibility_type = 'public'
    and coalesce(l.public_status, 'open') in ('open', 'full', 'awaiting_minimum')
  order by l.created_at asc
  limit 1;

  if v_league.id is not null then
    return jsonb_build_object('ok', true, 'league_slug', v_league.slug, 'message', 'Already in public league');
  end if;

  -- Oldest open public league with available spots.
  select l.*
  into v_league
  from public.leagues l
  where l.visibility_type = 'public'
    and coalesce(l.public_status, 'open') in ('open', 'awaiting_minimum')
    and coalesce(l.max_teams, 6) > 0
  order by l.created_at asc
  limit 1
  for update skip locked;

  if v_league.id is null then
    return jsonb_build_object('ok', false, 'error', 'No open public leagues available right now.');
  end if;

  select count(*)::int into v_count
  from public.league_members
  where league_id = v_league.id;

  if v_count >= coalesce(v_league.max_teams, 6) then
    update public.leagues
    set public_status = 'full'
    where id = v_league.id;
    return jsonb_build_object('ok', false, 'error', 'No open public leagues available right now.');
  end if;

  insert into public.league_members (league_id, user_id, role)
  values (v_league.id, v_uid, 'owner');

  v_count := v_count + 1;
  if v_count >= coalesce(v_league.max_teams, 6) then
    v_status := 'full';
  elsif v_count >= 3 then
    v_status := 'open';
  else
    v_status := 'awaiting_minimum';
  end if;

  update public.leagues
  set public_status = v_status
  where id = v_league.id;

  return jsonb_build_object('ok', true, 'league_slug', v_league.slug);
end;
$$;

grant execute on function public.join_oldest_public_league() to authenticated;
