/* Required signup profile fields:
   - display_name captured in signup form
   - accepted_terms_at / accepted_privacy_at timestamps
   - timezone captured from browser when available
*/

alter table public.profiles
  add column if not exists accepted_terms_at timestamptz null,
  add column if not exists accepted_privacy_at timestamptz null;

comment on column public.profiles.accepted_terms_at is 'When the user accepted Terms of Service.';
comment on column public.profiles.accepted_privacy_at is 'When the user accepted Privacy Policy.';

/* Keep profile auto-create trigger in sync with signup metadata. */
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

  insert into public.profiles (id, display_name, timezone, accepted_terms_at, accepted_privacy_at)
  values (new.id, nullif(trim(initial_name), ''), initial_timezone, accepted_terms, accepted_privacy);
  return new;
end;
$$;
