-- Treat public salary-cap members with at least one wrestler as placed (active),
-- even if they have not spent their full fantasy budget.

update public.league_members m
set placement_status = 'active'
from public.leagues l
where m.league_id = l.id
  and l.visibility_type = 'public'
  and l.league_type = 'salary_cap'
  and m.placement_status = 'pending'
  and exists (
    select 1
    from public.league_rosters r
    where r.league_id = m.league_id
      and r.user_id = m.user_id
      and r.released_at is null
  );

-- Count placed factions toward public league minimum using roster-started members too.
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
  from public.league_members m
  where m.league_id = v_league.id
    and (
      coalesce(m.placement_status, 'active') = 'active'
      or exists (
        select 1
        from public.league_rosters r
        where r.league_id = m.league_id
          and r.user_id = m.user_id
          and r.released_at is null
      )
    );

  v_cap := v_league.max_teams;
  if v_cap is not null and v_count >= v_cap then
    update public.leagues
    set public_status = 'full'
    where id = v_league.id;
    return jsonb_build_object('ok', false, 'error', 'No open public leagues available right now.');
  end if;

  insert into public.league_members (league_id, user_id, role, placement_status)
  values (v_league.id, v_uid, 'owner', 'pending');

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
