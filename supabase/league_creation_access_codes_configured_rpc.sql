/* Additive migration: run if you already applied league_creation_access_codes.sql before this
   function existed. Fresh installs can rely on the updated league_creation_access_codes.sql instead.
   RLS blocks direct SELECT on league_creation_access_codes; the app calls this for UI/config checks. */

create or replace function public.league_creation_access_codes_configured()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.league_creation_access_codes
    where is_active = true
    limit 1
  );
$$;

grant execute on function public.league_creation_access_codes_configured() to authenticated;
