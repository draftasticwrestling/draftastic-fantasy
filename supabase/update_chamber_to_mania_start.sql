-- One-off: set "draftastic Test 2" / Chamber to Mania league to start as of 2026-02-12 (yesterday).
-- Run in Supabase SQL Editor (or psql). Uses draft_date so points count from first event on or after this date.

update public.leagues
set draft_date = '2026-02-12'
where slug = 'draftastic-test-2'
   or name ilike '%draftastic test 2%'
   or name ilike '%chamber to mania%';

-- Optional: see what was updated
-- select id, name, slug, start_date, draft_date from public.leagues where slug = 'draftastic-test-2' or name ilike '%chamber to mania%';
