-- Broadcast start timestamps for accurate roster point attribution.
--
-- Policy:
-- - Points count for an event if roster acquisition time is before event broadcast start.
-- - Because we may not always have a reliable broadcast start time from Boxscore,
--   we infer defaults for US-like events (location ends with a US state code).
--
-- Inference defaults (America/New_York):
-- - Raw / SmackDown: 20:00
-- - Everything else (PLE): 19:00
--
-- International exceptions:
-- - If location does not look US-like, we leave broadcast_start_ts null.
--   Scoring will fall back to date-only clamped semantics so points never disappear.

alter table public.events
  add column if not exists broadcast_start_ts timestamptz null;

alter table public.events
  add column if not exists broadcast_start_ts_source text null;

-- Backfill inferred broadcast start timestamps for completed events where unset.
-- Idempotent: only updates when broadcast_start_ts is null.
update public.events e
set
  broadcast_start_ts =
    (
      e.date::timestamp
      + case
          when lower(e.name) like '%raw%' or lower(e.name) like '%smackdown%' then interval '20 hours'
          else interval '19 hours'
        end
    ) AT TIME ZONE 'America/New_York',
  broadcast_start_ts_source = 'inferred-et-default'
where
  e.status = 'completed'
  and e.broadcast_start_ts is null
  and e.date is not null
  and (
    e.location is null
    or regexp_replace(e.location, '^.*,\s*', '') in (
      'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS',
      'MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'
    )
  );

