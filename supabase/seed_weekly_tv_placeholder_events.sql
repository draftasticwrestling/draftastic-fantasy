-- Placeholder upcoming weekly TV events: Raw (Monday), WWE NXT (Tuesday), SmackDown (Friday).
-- Generates 2 calendar years from the run date. Location TBD; broadcast defaults to 5:00 PM Pacific.
--
-- Idempotent:
--   - Skips rows whose canonical id already exists (raw-YYYY-MM-DD, nxt-YYYY-MM-DD, smackdown-YYYY-MM-DD).
--   - Skips a slot when any event on that date already looks like the same weekly show.
--
-- PLEs are not seeded here — add those in boxscore admin when announced.

begin;

with bounds as (
  select
    current_date::date as start_date,
    (current_date + interval '2 years')::date as end_date
),
days as (
  select gs::date as dt
  from bounds b
  cross join generate_series(b.start_date, b.end_date, interval '1 day') gs
),
slots as (
  select
    dt,
    'raw'::text as show_key,
    'Raw'::text as name,
    'RAW'::text as event_type
  from days
  where extract(dow from dt) = 1

  union all

  select dt, 'nxt', 'WWE NXT', 'WWE NXT'
  from days
  where extract(dow from dt) = 2

  union all

  select dt, 'smackdown', 'SmackDown', 'SmackDown'
  from days
  where extract(dow from dt) = 5
),
candidates as (
  select
    show_key || '-' || to_char(dt, 'YYYY-MM-DD') as id,
    name,
    dt as event_date,
    event_type,
    show_key
  from slots
)
insert into public.events (
  id,
  name,
  date,
  location,
  event_type,
  status,
  matches,
  "isLive",
  broadcast_start_ts,
  broadcast_start_ts_source
)
select
  c.id,
  c.name,
  c.event_date,
  'TBD',
  c.event_type,
  'upcoming',
  '[]'::jsonb,
  false,
  (to_char(c.event_date, 'YYYY-MM-DD') || ' 17:00:00')::timestamp at time zone 'America/Los_Angeles',
  'seed-weekly-placeholder'
from candidates c
where not exists (
  select 1
  from public.events e
  where e.date::date = c.event_date
    and case c.show_key
      when 'raw' then
        lower(coalesce(e.event_type, '')) = 'raw'
        or lower(coalesce(e.id, '')) like 'raw-%'
        or (
          lower(coalesce(e.name, '')) like '%raw%'
          and lower(coalesce(e.name, '')) not like '%smackdown%'
        )
      when 'smackdown' then
        lower(coalesce(e.event_type, '')) = 'smackdown'
        or lower(coalesce(e.id, '')) like 'smackdown-%'
        or lower(coalesce(e.name, '')) like '%smackdown%'
        or lower(coalesce(e.name, '')) like '%smack down%'
      when 'nxt' then
        lower(coalesce(e.event_type, '')) in ('wwe nxt', 'nxt')
        or lower(coalesce(e.id, '')) ~ '^nxt-[0-9]{4}-[0-9]{2}-[0-9]{2}$'
        or lower(trim(coalesce(e.name, ''))) in ('wwe nxt', 'nxt')
      else false
    end
)
on conflict (id) do nothing;

commit;
