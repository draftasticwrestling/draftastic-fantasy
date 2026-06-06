-- Original El Grande Americano (OEGA) is alumni/inactive; Chad Gable is the active performer.
-- Rewire fantasy rosters and related wrestler_id references from OEGA → Chad Gable.
-- Safe to re-run (no-op when OEGA id is not found).

do $$
declare
  oega_id text;
  chad_id text;
begin
  select w.id into oega_id
  from public.wrestlers w
  where lower(trim(w.id)) in ('original-el-grande-americano', 'original el grande americano')
     or lower(trim(coalesce(w.name, ''))) = 'original el grande americano'
  order by case when lower(trim(w.id)) = 'original-el-grande-americano' then 0 else 1 end
  limit 1;

  select w.id into chad_id
  from public.wrestlers w
  where lower(trim(w.id)) in ('chad-gable', 'chad gable')
     or lower(trim(coalesce(w.name, ''))) = 'chad gable'
  order by case when lower(trim(w.id)) = 'chad-gable' then 0 else 1 end
  limit 1;

  if oega_id is null then
    raise notice 'migrate_oega: no Original El Grande Americano wrestler row found';
    return;
  end if;
  if chad_id is null then
    raise notice 'migrate_oega: no Chad Gable wrestler row found';
    return;
  end if;
  if oega_id = chad_id then
    return;
  end if;

  raise notice 'migrate_oega: % → %', oega_id, chad_id;

  -- Active roster: drop OEGA stint when Chad is already on the same faction roster.
  delete from public.league_rosters oega_lr
  using public.league_rosters chad_lr
  where oega_lr.wrestler_id = oega_id
    and chad_lr.wrestler_id = chad_id
    and oega_lr.league_id = chad_lr.league_id
    and oega_lr.user_id = chad_lr.user_id
    and oega_lr.released_at is null
    and chad_lr.released_at is null;

  update public.league_rosters
  set wrestler_id = chad_id
  where wrestler_id = oega_id;

  update public.league_draft_picks
  set wrestler_id = chad_id
  where wrestler_id = oega_id;

  update public.league_lineups
  set wrestler_id = chad_id
  where wrestler_id = oega_id;

  delete from public.user_watchlist oega_wl
  using public.user_watchlist chad_wl
  where oega_wl.wrestler_id = oega_id
    and chad_wl.wrestler_id = chad_id
    and oega_wl.user_id = chad_wl.user_id
    and oega_wl.league_id = chad_wl.league_id;

  update public.user_watchlist
  set wrestler_id = chad_id
  where wrestler_id = oega_id;

  update public.league_trade_proposal_items
  set wrestler_id = chad_id
  where wrestler_id = oega_id;

  update public.league_release_proposals
  set wrestler_id = chad_id
  where wrestler_id = oega_id;

  update public.league_free_agent_proposals
  set wrestler_id = chad_id
  where wrestler_id = oega_id;

  update public.league_free_agent_proposals
  set drop_wrestler_id = chad_id
  where drop_wrestler_id = oega_id;

  update public.league_activity
  set wrestler_id = chad_id
  where wrestler_id = oega_id;

  update public.league_activity
  set secondary_wrestler_id = chad_id
  where secondary_wrestler_id = oega_id;

  update public.league_trade_proposals
  set to_user_drop_ids = (
    select coalesce(array_agg(case when x = oega_id then chad_id else x end), '{}')
    from unnest(to_user_drop_ids) as t(x)
  )
  where to_user_drop_ids is not null
    and oega_id = any (to_user_drop_ids);

  -- priority_list is usually jsonb[]; some rows store JSON.stringify(list) as a jsonb string scalar.
  update public.league_draft_preferences dp
  set priority_list = sub.new_list
  from (
    select
      dp2.league_id,
      dp2.user_id,
      coalesce(
        (
          select jsonb_agg(
            case
              when elem #>> '{}' = oega_id then to_jsonb(chad_id)
              else elem
            end
            order by ord
          )
          from jsonb_array_elements(dp2.priority_list) with ordinality as t(elem, ord)
        ),
        '[]'::jsonb
      ) as new_list
    from public.league_draft_preferences dp2
    where jsonb_typeof(dp2.priority_list) = 'array'
      and exists (
        select 1
        from jsonb_array_elements_text(dp2.priority_list) as e(v)
        where e.v = oega_id
      )
  ) sub
  where dp.league_id = sub.league_id
    and dp.user_id = sub.user_id;

  update public.league_draft_preferences dp
  set priority_list = sub.new_list
  from (
    select
      dp2.league_id,
      dp2.user_id,
      coalesce(
        (
          select jsonb_agg(
            case when v = oega_id then to_jsonb(chad_id) else to_jsonb(v) end
            order by ord
          )
          from jsonb_array_elements_text((dp2.priority_list #>> '{}')::jsonb) with ordinality as t(v, ord)
        ),
        '[]'::jsonb
      ) as new_list
    from public.league_draft_preferences dp2
    where jsonb_typeof(dp2.priority_list) = 'string'
      and jsonb_typeof((dp2.priority_list #>> '{}')::jsonb) = 'array'
      and exists (
        select 1
        from jsonb_array_elements_text((dp2.priority_list #>> '{}')::jsonb) as e(v)
        where e.v = oega_id
      )
  ) sub
  where dp.league_id = sub.league_id
    and dp.user_id = sub.user_id;

  delete from public.roster_assignments oega_ra
  using public.roster_assignments chad_ra
  where oega_ra.wrestler_id = oega_id
    and chad_ra.wrestler_id = chad_id
    and oega_ra.league_slug = chad_ra.league_slug
    and oega_ra.owner_slug = chad_ra.owner_slug;

  update public.roster_assignments
  set wrestler_id = chad_id
  where wrestler_id = oega_id;
end $$;
