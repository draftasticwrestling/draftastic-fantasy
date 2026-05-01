-- NXT current champions (synthetic snapshot). Aligns with lib/pwbsChampionshipSlug.js slugs.
-- Run in Supabase after your championships table exists. Adjust wrestler slugs to match public.wrestlers.id.
-- If your rows use different `id` values, change the ON CONFLICT target or use UPDATE ... WHERE id = '...' instead.

insert into public.championships (
  id,
  title_name,
  brand,
  type,
  current_champion,
  current_champion_slug
)
values
  (
    'nxt-championship',
    'NXT Championship',
    'NXT',
    'singles',
    'Tony D''Angelo',
    'tony-dangelo'
  ),
  (
    'nxt-womens-championship',
    'NXT Women''s Championship',
    'NXT',
    'singles',
    'Lola Vice',
    'lola-vice'
  ),
  (
    'nxt-north-american-championship',
    'NXT North American Championship',
    'NXT',
    'singles',
    'Myles Borne',
    'myles-borne'
  ),
  (
    'nxt-womens-north-american-championship',
    'NXT Women''s North American Championship',
    'NXT',
    'singles',
    'Tatum Paxley',
    'tatum-paxley'
  ),
  (
    'nxt-tag-team-championship',
    'NXT Tag Team Championship',
    'NXT',
    'tag',
    'The Vanity Project (Brad Baylor & Ricky Smokes)',
    'brad-baylor'
  ),
  (
    'nxt-mens-speed-championship',
    'NXT Men''s Speed Championship',
    'NXT',
    'singles',
    'Lexis King',
    'lexis-king'
  ),
  (
    'nxt-womens-speed-championship',
    'NXT Women''s Speed Championship',
    'NXT',
    'singles',
    'Wren Sinclair',
    'wren-sinclair'
  )
on conflict (id) do update set
  title_name = excluded.title_name,
  brand = excluded.brand,
  type = excluded.type,
  current_champion = excluded.current_champion,
  current_champion_slug = excluded.current_champion_slug;

-- Keep championship_history in sync so history-driven cards/pages include NXT titles.
-- Schema-tolerant: supports either won_date/lost_date or date_won/date_lost naming.
do $$
declare
  has_won_date boolean;
  has_start_date boolean;
  has_date_won boolean;
  has_lost_date boolean;
  has_end_date boolean;
  has_date_lost boolean;
  has_champion_name boolean;
  has_title_name boolean;
  has_title boolean;
  has_previous_champion boolean;
  has_previous_champion_slug boolean;
  won_col text;
  start_col text;
  close_set_sql text := '';
  open_pred_sql text := 'true';
  insert_cols text := 'championship_id, champion_slug, champion';
  insert_vals text := 'src.championship_id, src.champion_slug, src.champion_name';
begin
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'championship_history' and column_name = 'won_date'
  ) into has_won_date;
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'championship_history' and column_name = 'start_date'
  ) into has_start_date;
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'championship_history' and column_name = 'date_won'
  ) into has_date_won;
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'championship_history' and column_name = 'lost_date'
  ) into has_lost_date;
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'championship_history' and column_name = 'end_date'
  ) into has_end_date;
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'championship_history' and column_name = 'date_lost'
  ) into has_date_lost;
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'championship_history' and column_name = 'champion_name'
  ) into has_champion_name;
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'championship_history' and column_name = 'title_name'
  ) into has_title_name;
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'championship_history' and column_name = 'title'
  ) into has_title;
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'championship_history' and column_name = 'previous_champion'
  ) into has_previous_champion;
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'championship_history' and column_name = 'previous_champion_slug'
  ) into has_previous_champion_slug;

  won_col := case
    when has_won_date then 'won_date'
    when has_date_won then 'date_won'
    else null
  end;
  start_col := case
    when has_start_date then 'start_date'
    when has_date_won then 'date_won'
    else null
  end;

  if has_lost_date then
    close_set_sql := close_set_sql || case when close_set_sql = '' then '' else ', ' end || 'lost_date = coalesce(lost_date, current_date)';
    open_pred_sql := open_pred_sql || ' and coalesce(h.lost_date::text, '''') = ''''';
  end if;
  if has_end_date then
    close_set_sql := close_set_sql || case when close_set_sql = '' then '' else ', ' end || 'end_date = coalesce(end_date, current_date)';
    open_pred_sql := open_pred_sql || ' and coalesce(h.end_date::text, '''') = ''''';
  end if;
  if has_date_lost then
    close_set_sql := close_set_sql || case when close_set_sql = '' then '' else ', ' end || 'date_lost = coalesce(date_lost, current_date)';
    open_pred_sql := open_pred_sql || ' and coalesce(h.date_lost::text, '''') = ''''';
  end if;

  if won_col is not null then
    insert_cols := insert_cols || ', ' || won_col;
    insert_vals := insert_vals || ', current_date';
  end if;
  if start_col is not null and start_col <> won_col then
    insert_cols := insert_cols || ', ' || start_col;
    insert_vals := insert_vals || ', current_date';
  end if;
  if has_lost_date then
    insert_cols := insert_cols || ', lost_date';
    insert_vals := insert_vals || ', null';
  end if;
  if has_end_date then
    insert_cols := insert_cols || ', end_date';
    insert_vals := insert_vals || ', null';
  end if;
  if has_date_lost then
    insert_cols := insert_cols || ', date_lost';
    insert_vals := insert_vals || ', null';
  end if;
  if has_champion_name then
    insert_cols := insert_cols || ', champion_name';
    insert_vals := insert_vals || ', src.champion_name';
  end if;
  if has_title_name then
    insert_cols := insert_cols || ', title_name';
    insert_vals := insert_vals || ', src.title_name';
  end if;
  if has_title then
    insert_cols := insert_cols || ', title';
    insert_vals := insert_vals || ', src.title_name';
  end if;
  if has_previous_champion then
    insert_cols := insert_cols || ', previous_champion';
    insert_vals := insert_vals || ', null';
  end if;
  if has_previous_champion_slug then
    insert_cols := insert_cols || ', previous_champion_slug';
    insert_vals := insert_vals || ', null';
  end if;

  execute format($sql$
    with src as (
      select *
      from (
        values
          ('nxt-championship', 'NXT Championship', 'tony-dangelo', 'Tony D''Angelo'),
          ('nxt-womens-championship', 'NXT Women''s Championship', 'lola-vice', 'Lola Vice'),
          ('nxt-north-american-championship', 'NXT North American Championship', 'myles-borne', 'Myles Borne'),
          ('nxt-womens-north-american-championship', 'NXT Women''s North American Championship', 'tatum-paxley', 'Tatum Paxley'),
          ('nxt-tag-team-championship', 'NXT Tag Team Championship', 'brad-baylor', 'The Vanity Project (Brad Baylor & Ricky Smokes)'),
          ('nxt-mens-speed-championship', 'NXT Men''s Speed Championship', 'lexis-king', 'Lexis King'),
          ('nxt-womens-speed-championship', 'NXT Women''s Speed Championship', 'wren-sinclair', 'Wren Sinclair')
      ) as t(championship_id, title_name, champion_slug, champion_name)
    ),
    closed as (
      %s
    ),
    ins as (
      insert into public.championship_history (%s)
      select %s
      from src
      where not exists (
        select 1
        from public.championship_history h
        where
          coalesce(h.championship_id, '') = src.championship_id
          and coalesce(lower(h.champion_slug), '') = lower(src.champion_slug)
          and %s
      )
      returning 1
    )
    select count(*) as inserted_rows from ins;
  $sql$,
    case
      when close_set_sql = '' then 'select 1 where false'
      else format(
        'update public.championship_history h set %s from src where coalesce(h.championship_id, '''') = src.championship_id and %s and coalesce(lower(h.champion_slug), '''') <> lower(src.champion_slug)',
        close_set_sql,
        open_pred_sql
      )
    end,
    insert_cols,
    insert_vals,
    open_pred_sql
  );
end $$;
