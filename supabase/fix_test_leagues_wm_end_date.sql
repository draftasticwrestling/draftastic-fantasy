-- Set WrestleMania-season test leagues to the true season end (WM Night 2).
-- Final scoring should lock after 11:59 PM PT on this date.

update public.leagues
set end_date = '2026-04-19'
where slug in ('season-points-test', 'draftastic-test-2');

-- Verify:
-- select slug, start_date, end_date from public.leagues
-- where slug in ('season-points-test', 'draftastic-test-2');
