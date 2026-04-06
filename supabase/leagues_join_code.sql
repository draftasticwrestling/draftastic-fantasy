-- Permanent league join codes (no expiry) + longer-lived invite links + reusable invite tokens until expiry.

alter table public.leagues
  add column if not exists join_code text;

comment on column public.leagues.join_code is 'Permanent invite code (XXXX-XXXX). Join via join_league_with_code().';

create unique index if not exists idx_leagues_join_code_unique
  on public.leagues (join_code)
  where join_code is not null;

-- Backfill codes for existing leagues (readable XXXX-XXXX).
do $$
declare
  r record;
  new_code text;
  attempts int;
  charset constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  i int;
  c text;
begin
  for r in select id from public.leagues where join_code is null loop
    attempts := 0;
    loop
      new_code := '';
      for i in 1..4 loop
        c := substr(charset, floor(random() * length(charset) + 1)::int, 1);
        new_code := new_code || c;
      end loop;
      new_code := new_code || '-';
      for i in 1..4 loop
        c := substr(charset, floor(random() * length(charset) + 1)::int, 1);
        new_code := new_code || c;
      end loop;
      begin
        update public.leagues set join_code = new_code where id = r.id;
        exit;
      exception
        when unique_violation then
          attempts := attempts + 1;
          if attempts > 80 then
            raise exception 'Could not allocate unique join_code for league %', r.id;
          end if;
      end;
    end loop;
  end loop;
end $$;

/* Join a league using a permanent code. */
create or replace function public.join_league_with_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_league public.leagues;
  v_uid uuid;
  v_norm text;
  v_count int;
begin
  v_uid := auth.uid();
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'Not authenticated');
  end if;

  v_norm := upper(regexp_replace(trim(p_code), '\s+', '', 'g'));
  v_norm := replace(v_norm, '-', '');

  if length(v_norm) < 6 or length(v_norm) > 16 then
    return jsonb_build_object('ok', false, 'error', 'Invalid league code');
  end if;

  /* Lock league row so concurrent joins cannot exceed max_teams. */
  select * into v_league
  from public.leagues
  where upper(replace(join_code, '-', '')) = v_norm
  limit 1
  for update;

  if v_league.id is null then
    return jsonb_build_object('ok', false, 'error', 'Invalid league code');
  end if;

  if exists (
    select 1 from public.league_members
    where league_id = v_league.id and user_id = v_uid
  ) then
    return jsonb_build_object('ok', true, 'league_slug', v_league.slug, 'message', 'Already in league');
  end if;

  select count(*)::int into v_count from public.league_members where league_id = v_league.id;

  /* Capacity: compare to leagues.max_teams (set at league creation). If max_teams is null, no cap. */
  if v_league.max_teams is not null and v_count >= v_league.max_teams then
    return jsonb_build_object('ok', false, 'error', 'This league is full.');
  end if;

  insert into public.league_members (league_id, user_id, role)
  values (v_league.id, v_uid, 'owner');

  return jsonb_build_object('ok', true, 'league_slug', v_league.slug);
end;
$$;

grant execute on function public.join_league_with_code(text) to authenticated;

/* Invite tokens: reusable until expires_at; enforce league capacity. */
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

comment on function public.join_league_with_code(text) is 'Join by permanent code; rejects when league_members count >= leagues.max_teams.';
comment on function public.join_league_with_token(text) is 'Join by invite token; rejects when league is at max_teams.';
