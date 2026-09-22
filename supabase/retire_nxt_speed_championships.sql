-- Retire NXT Men's / Women's Speed Championships (WWE vacated Sept 1, 2026).
-- Preserves championship_history rows; closes open reigns and clears current holders.
-- Scoring also uses lib/retiredChampionships.js (retiredAtYmd) so points stop even before this SQL runs.

alter table public.championships
  add column if not exists retired_at date;

comment on column public.championships.retired_at is
  'First calendar day the title awards no fantasy points (null = active). History before this date is unchanged.';

update public.championships
set
  retired_at = '2026-09-01',
  current_champion = null,
  current_champion_slug = null,
  previous_champion = coalesce(previous_champion, current_champion),
  previous_champion_slug = coalesce(previous_champion_slug, current_champion_slug)
where id in ('nxt-mens-speed-championship', 'nxt-womens-speed-championship');

-- Close open reigns so history shows the title ended at retirement (do not delete rows).
do $$
declare
  has_lost_date boolean;
  has_end_date boolean;
  has_date_lost boolean;
  close_sql text;
begin
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

  if has_lost_date then
    execute $q$
      update public.championship_history
      set lost_date = '2026-09-01'
      where championship_id in ('nxt-mens-speed-championship', 'nxt-womens-speed-championship')
        and (lost_date is null or btrim(lost_date::text) = '')
    $q$;
  end if;

  if has_end_date then
    execute $q$
      update public.championship_history
      set end_date = '2026-09-01'
      where championship_id in ('nxt-mens-speed-championship', 'nxt-womens-speed-championship')
        and (end_date is null or btrim(end_date::text) = '')
    $q$;
  end if;

  if has_date_lost then
    execute $q$
      update public.championship_history
      set date_lost = '2026-09-01'
      where championship_id in ('nxt-mens-speed-championship', 'nxt-womens-speed-championship')
        and (date_lost is null or btrim(date_lost::text) = '')
    $q$;
  end if;
end $$;
