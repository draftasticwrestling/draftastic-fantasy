-- One-off: Restrict "Draftastic Test 2" league to only count the 2/20 SmackDown event.
-- Points will then show: only wrestlers who competed on that date (e.g. Carmelo Hayes 1 pt, Tama Tonga 3 pts).
-- Run in Supabase SQL Editor.

update public.leagues
set draft_date = '2026-02-20',
    end_date   = '2026-02-20'
where slug = 'draftastic-test-2'
   or name ilike '%draftastic test 2%'
   or name ilike '%chamber to mania%';

-- Optional: verify
-- select id, name, slug, start_date, end_date, draft_date from public.leagues where slug = 'draftastic-test-2';
