/* One-time repair: align *_at_ts with calendar acquired_at / released_at (UTC date).
   Acquired -> 12:00 UTC on acquired_at. Released -> 23:59:59.999 UTC on released_at.
   Run in Supabase SQL editor (paste only this file, or run statements below). */

update public.league_rosters lr
set acquired_at_ts = (lr.acquired_at::text || 'T12:00:00+00')::timestamptz
where lr.acquired_at is not null
  and lr.acquired_at_ts is not null
  and (
    (lr.acquired_at_ts at time zone 'utc')::date
    is distinct from
    lr.acquired_at::date
  );

update public.league_rosters lr
set released_at_ts = (lr.released_at::text || 'T23:59:59.999+00')::timestamptz
where lr.released_at is not null
  and lr.released_at_ts is not null
  and (
    (lr.released_at_ts at time zone 'utc')::date
    is distinct from
    lr.released_at::date
  );

-- Backfill missing released_at_ts (e.g. code paths that only set released_at).
update public.league_rosters lr
set released_at_ts = (lr.released_at::text || 'T23:59:59.999+00')::timestamptz
where lr.released_at is not null
  and lr.released_at_ts is null;
