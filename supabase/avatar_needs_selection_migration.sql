-- Step 5: require starter-pack avatar selection for users not on the catalog.
-- Run after avatar_packs.sql and starter-pack sync (catalog + storage populated).
-- Safe to re-run.
-- Site admins (is_site_admin) keep legacy/special avatars and are never forced to reselect.

-- Site admins are always exempt.
update public.profiles
set needs_avatar_selection = false
where coalesce(is_site_admin, false) = true;

-- Non-admins without a catalog character must pick from the starter pack.
update public.profiles
set
  needs_avatar_selection = true,
  avatar_url = case
    when coalesce(trim(avatar_url), '') <> '' then null
    else avatar_url
  end
where avatar_id is null
  and coalesce(is_site_admin, false) = false;

-- Non-admins already linked to the catalog are done.
update public.profiles
set needs_avatar_selection = false
where avatar_id is not null
  and coalesce(is_site_admin, false) = false;

-- New signups must pick a starter character before using protected areas (not site admins at signup).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  initial_name text;
  initial_timezone text;
  accepted_terms timestamptz;
  accepted_privacy timestamptz;
begin
  initial_name := coalesce(
    new.raw_user_meta_data ->> 'display_name',
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name',
    split_part(coalesce(new.email, ''), '@', 1)
  );
  if initial_name = '' then
    initial_name := null;
  end if;

  initial_timezone := nullif(trim(coalesce(new.raw_user_meta_data ->> 'timezone', '')), '');
  accepted_terms := nullif(trim(coalesce(new.raw_user_meta_data ->> 'accepted_terms_at', '')), '')::timestamptz;
  accepted_privacy := nullif(trim(coalesce(new.raw_user_meta_data ->> 'accepted_privacy_at', '')), '')::timestamptz;

  insert into public.profiles (
    id,
    display_name,
    timezone,
    accepted_terms_at,
    accepted_privacy_at,
    needs_avatar_selection
  )
  values (
    new.id,
    nullif(trim(initial_name), ''),
    initial_timezone,
    accepted_terms,
    accepted_privacy,
    true
  );

  perform public.grant_default_avatar_packs(new.id);

  return new;
end;
$$;
