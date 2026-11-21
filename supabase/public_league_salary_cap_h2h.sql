-- New public leagues use league_type salary_cap_h2h (max 8, start at 4).
-- Existing salary_cap public leagues stay on the 3-faction Total Season Points rule.
-- App code also corrects status after each join; this keeps the join RPC itself in line.

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
  v_cap int;
  v_min int;
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
    and l.league_type in ('salary_cap', 'salary_cap_h2h')
    and (
      (
        coalesce(l.public_status, 'open') in ('open', 'awaiting_minimum')
        and (l.registration_closes_at is null or l.registration_closes_at > now())
      )
      or (
        coalesce(l.public_status, 'open') in ('active', 'full')
        and l.end_date is not null
        and l.end_date >= (timezone('America/Los_Angeles', now()))::date
      )
    )
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
    and (
      l.registration_closes_at is null
      or l.registration_closes_at > now()
    )
  order by l.created_at asc
  limit 1
  for update skip locked;

  if v_league.id is null then
    return jsonb_build_object('ok', false, 'error', 'No open public leagues available right now.');
  end if;

  select count(*)::int into v_count
  from public.league_members
  where league_id = v_league.id;

  v_cap := v_league.max_teams;
  if v_cap is not null and v_count >= v_cap then
    update public.leagues
    set public_status = 'full'
    where id = v_league.id;
    return jsonb_build_object('ok', false, 'error', 'No open public leagues available right now.');
  end if;

  insert into public.league_members (league_id, user_id, role)
  values (
    v_league.id,
    v_uid,
    case when v_count = 0 then 'commissioner' else 'owner' end
  );

  v_count := v_count + 1;
  if v_count = 1 then
    update public.leagues
    set commissioner_id = v_uid
    where id = v_league.id;
  end if;

  v_min := case when v_league.league_type = 'salary_cap_h2h' then 4 else 3 end;
  if v_cap is not null and v_count >= v_cap then
    v_status := 'full';
  elsif v_count >= v_min then
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
