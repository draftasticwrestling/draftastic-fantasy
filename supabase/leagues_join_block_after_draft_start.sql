-- Block joining after the draft has started (or completed / ready for review).
-- Capacity is still enforced via max_teams; when a GM starts short, startDraft shrinks max_teams
-- to the current member count so the league is also "full".

create or replace function public.join_league_with_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_league public.leagues;
  v_uid uuid;
  v_count int;
  v_norm text;
begin
  v_uid := auth.uid();
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'Not authenticated');
  end if;

  v_norm := upper(replace(trim(p_code), '-', ''));
  if length(v_norm) < 6 or length(v_norm) > 16 then
    return jsonb_build_object('ok', false, 'error', 'Invalid league code');
  end if;

  select * into v_league
  from public.leagues
  where upper(replace(join_code, '-', '')) = v_norm
  limit 1
  for update;

  if v_league.id is null then
    return jsonb_build_object('ok', false, 'error', 'Invalid league code');
  end if;

  if coalesce(v_league.draft_status, 'not_started') <> 'not_started' then
    return jsonb_build_object('ok', false, 'error', 'This league is no longer accepting new teams.');
  end if;

  if exists (
    select 1 from public.league_members
    where league_id = v_league.id and user_id = v_uid
  ) then
    return jsonb_build_object('ok', true, 'league_slug', v_league.slug, 'message', 'Already in league');
  end if;

  select count(*)::int into v_count from public.league_members where league_id = v_league.id;

  if v_league.max_teams is not null and v_count >= v_league.max_teams then
    return jsonb_build_object('ok', false, 'error', 'This league is full.');
  end if;

  insert into public.league_members (league_id, user_id, role)
  values (v_league.id, v_uid, 'owner');

  return jsonb_build_object('ok', true, 'league_slug', v_league.slug);
end;
$$;

create or replace function public.join_league_with_token(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invite public.league_invites;
  v_league public.leagues;
  v_uid uuid;
  v_count int;
begin
  v_uid := auth.uid();
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'Not authenticated');
  end if;

  select * into v_invite
  from public.league_invites
  where token = p_token and expires_at > now()
  limit 1;

  if v_invite.id is null then
    return jsonb_build_object('ok', false, 'error', 'Invalid or expired invite link');
  end if;

  select * into v_league
  from public.leagues
  where id = v_invite.league_id
  for update;

  if v_league.id is null then
    return jsonb_build_object('ok', false, 'error', 'League not found');
  end if;

  if coalesce(v_league.draft_status, 'not_started') <> 'not_started' then
    return jsonb_build_object('ok', false, 'error', 'This league is no longer accepting new teams.');
  end if;

  if exists (select 1 from public.league_members where league_id = v_invite.league_id and user_id = v_uid) then
    return jsonb_build_object('ok', true, 'league_slug', v_league.slug, 'message', 'Already in league');
  end if;

  select count(*)::int into v_count from public.league_members where league_id = v_invite.league_id;

  if v_league.max_teams is not null and v_count >= v_league.max_teams then
    return jsonb_build_object('ok', false, 'error', 'This league is full.');
  end if;

  insert into public.league_members (league_id, user_id, role)
  values (v_invite.league_id, v_uid, 'owner');

  return jsonb_build_object('ok', true, 'league_slug', v_league.slug);
end;
$$;

comment on function public.join_league_with_code(text) is
  'Join by permanent code; rejects when draft has started or league_members count >= max_teams.';
comment on function public.join_league_with_token(text) is
  'Join by invite token; rejects when draft has started or league is at max_teams.';
