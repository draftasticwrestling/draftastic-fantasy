-- Pending vs active faction placement for public salary-cap leagues.
-- Users quick-join with placement_status = 'pending' until they finish initial roster setup.

alter table public.league_members
  add column if not exists placement_status text not null default 'active';

alter table public.league_members
  drop constraint if exists league_members_placement_status_check;

alter table public.league_members
  add constraint league_members_placement_status_check
  check (placement_status in ('pending', 'active'));

comment on column public.league_members.placement_status is
  'pending = joined public league but has not finished salary-cap roster setup; active = placed faction visible in standings';

-- Existing members are treated as already placed.
update public.league_members
set placement_status = 'active'
where placement_status is distinct from 'active';

-- Public salary-cap joins that never finished roster setup stay pending (hidden from standings).
update public.league_members m
set placement_status = 'pending'
from public.leagues l
where m.league_id = l.id
  and l.visibility_type = 'public'
  and l.league_type = 'salary_cap'
  and m.onboarding_completed_at is null;

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
  v_active_count int;
  v_status text;
  v_cap int;
begin
  v_uid := auth.uid();
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'Not authenticated');
  end if;

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

  select l.*
  into v_league
  from public.leagues l
  where l.visibility_type = 'public'
    and coalesce(l.public_status, 'open') in ('open', 'awaiting_minimum')
  order by l.created_at asc
  limit 1
  for update skip locked;

  if v_league.id is null then
    return jsonb_build_object('ok', false, 'error', 'No open public leagues available right now.');
  end if;

  select count(*)::int into v_count
  from public.league_members
  where league_id = v_league.id;

  select count(*)::int into v_active_count
  from public.league_members
  where league_id = v_league.id
    and coalesce(placement_status, 'active') = 'active';

  v_cap := v_league.max_teams;
  if v_cap is not null and v_count >= v_cap then
    update public.leagues
    set public_status = 'full'
    where id = v_league.id;
    return jsonb_build_object('ok', false, 'error', 'No open public leagues available right now.');
  end if;

  insert into public.league_members (league_id, user_id, role, placement_status)
  values (v_league.id, v_uid, 'owner', 'pending');

  v_active_count := v_active_count; -- unchanged until roster setup completes
  if v_cap is not null and v_count + 1 >= v_cap then
    v_status := 'full';
  elsif v_active_count >= 3 then
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
