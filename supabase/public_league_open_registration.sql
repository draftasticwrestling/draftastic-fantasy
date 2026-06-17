-- Public league open registration: Monday RAW close, salary snapshots, quick-join RPC.

alter table public.leagues
  add column if not exists registration_closes_at timestamptz null;

comment on column public.leagues.registration_closes_at is
  'Public salary-cap leagues: enrollment closes at this instant (Monday 5 PM PT). Scoring begins then.';

create table if not exists public.league_wrestler_salary_snapshots (
  league_id uuid not null references public.leagues(id) on delete cascade,
  wrestler_id text not null,
  salary_cap_cost integer not null,
  primary key (league_id, wrestler_id),
  constraint league_wrestler_salary_snapshots_cost_check
    check (salary_cap_cost in (5, 10, 15, 20, 25))
);

comment on table public.league_wrestler_salary_snapshots is
  'Frozen wrestler salary_cap_cost per league for the 12-week public season.';

alter table public.league_wrestler_salary_snapshots enable row level security;

drop policy if exists "league_wrestler_salary_snapshots_select_member" on public.league_wrestler_salary_snapshots;
create policy "league_wrestler_salary_snapshots_select_member"
  on public.league_wrestler_salary_snapshots for select
  using (
    exists (
      select 1 from public.league_members m
      where m.league_id = league_wrestler_salary_snapshots.league_id
        and m.user_id = auth.uid()
    )
  );

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
    and coalesce(l.public_status, 'open') in ('open', 'full', 'awaiting_minimum', 'active')
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

  if v_count = 0 then
    update public.leagues
    set commissioner_id = v_uid
    where id = v_league.id;
  end if;

  v_count := v_count + 1;
  v_status := 'open';

  update public.leagues
  set public_status = v_status
  where id = v_league.id;

  return jsonb_build_object('ok', true, 'league_slug', v_league.slug);
end;
$$;

grant execute on function public.join_oldest_public_league() to authenticated;
