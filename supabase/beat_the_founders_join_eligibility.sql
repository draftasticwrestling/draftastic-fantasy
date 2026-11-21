-- Beat the Founders: only founders and public-league champions through 2026-11-15
-- may be added. B-Dawg Steven (family of a founder) is disqualified even though
-- he won a public league. Applies to invite links, league codes, and admin inserts.

create or replace function public.enforce_beat_the_founders_eligibility()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_slug text;
begin
  select slug into v_slug
  from public.leagues
  where id = new.league_id;

  if v_slug is distinct from 'beat-the-founders-league' then
    return new;
  end if;

  if new.user_id = '9ab535e2-3ff6-4120-a1d1-ecfcd75ef618'::uuid then
    raise exception 'This account isn''t eligible to join Beat the Founders.'
      using errcode = '42501';
  end if;

  if new.user_id in (
    'e0efc9d7-4cb7-4226-aac9-6d21a222bc02'::uuid,
    'a7d23655-163c-4726-9435-fee99693d51f'::uuid,
    '427d44a2-018c-469d-977d-df63bdaf9b99'::uuid
  ) then
    return new;
  end if;

  if not exists (
    select 1
    from public.league_season_placements p
    join public.leagues won on won.id = p.league_id
    where p.user_id = new.user_id
      and p.placement = 1
      and won.visibility_type = 'public'
      and won.end_date <= date '2026-11-15'
  ) then
    raise exception 'This account isn''t eligible to join Beat the Founders.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists beat_the_founders_eligibility on public.league_members;

create trigger beat_the_founders_eligibility
  before insert on public.league_members
  for each row
  execute function public.enforce_beat_the_founders_eligibility();
