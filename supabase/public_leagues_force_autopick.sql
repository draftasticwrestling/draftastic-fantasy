-- One-time remediation:
-- Public leagues should never use offline draft_type.
-- This updates any existing public league rows currently set to offline.

update public.leagues
set draft_type = 'autopick'
where visibility_type = 'public'
  and draft_type = 'offline';

-- Verification query (run after the update):
-- select id, slug, name, visibility_type, draft_type
-- from public.leagues
-- where visibility_type = 'public'
-- order by created_at desc;
