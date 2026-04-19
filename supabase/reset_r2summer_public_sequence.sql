-- One-time: retitle the first public beta league to R2Summer 0 and reset public_sequence
-- so the next auto-created public league is R2Summer 1 (createLeague uses max(public_sequence)+1).
--
-- Run in Supabase → SQL Editor (service role / owner). After this, share the new URL:
--   /leagues/r2summer-0
--
-- Targets the row that was the first public league (sequence 1 or legacy slug r2summer-1).
-- If you have multiple public leagues, review rows first: select id, name, slug, public_sequence from leagues where visibility_type = 'public';

begin;

update public.leagues
set
  name = 'R2Summer 0',
  slug = 'r2summer-0',
  public_sequence = 0
where id = (
  select l.id
  from public.leagues l
  where l.visibility_type = 'public'
    and (
      l.public_sequence = 1
      or lower(trim(l.slug)) = 'r2summer-1'
      or trim(l.name) = 'R2Summer 1'
    )
  order by l.created_at asc
  limit 1
);

-- Optional: confirm (should show one row with sequence 0)
-- select id, name, slug, public_sequence from public.leagues where visibility_type = 'public' order by public_sequence nulls last;

commit;
