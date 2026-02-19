/* Profiles: display name and optional avatar for each auth user.
   Row is created automatically when a user signs up (trigger on auth.users). */

create table if not exists public.profiles (
  id uuid not null references auth.users on delete cascade,
  display_name text null,
  avatar_url text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (id)
);

comment on table public.profiles is 'User profile (display name, avatar). One row per auth user.';

create index if not exists idx_profiles_display_name on public.profiles (display_name);

alter table public.profiles enable row level security;

-- Anyone authenticated can read all profiles (e.g. show names in leagues).
create policy "Profiles are viewable by authenticated users"
  on public.profiles for select
  to authenticated
  using (true);

-- Users can update only their own profile.
create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Insert is done by the trigger (security definer), not by app users.
-- So we do not add an insert policy for authenticated.

/* Create a profile when a new user signs up. Uses raw_user_meta_data from
   OAuth (e.g. full_name from Google) or email prefix as initial display_name. */
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  initial_name text;
begin
  initial_name := coalesce(
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name',
    split_part(coalesce(new.email, ''), '@', 1)
  );
  if initial_name = '' then
    initial_name := null;
  end if;
  insert into public.profiles (id, display_name)
  values (new.id, nullif(trim(initial_name), ''));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

/* Backfill: create profiles for any existing auth.users that don't have one. */
insert into public.profiles (id, display_name)
select id, coalesce(
  raw_user_meta_data ->> 'full_name',
  raw_user_meta_data ->> 'name',
  split_part(coalesce(email, ''), '@', 1)
)
from auth.users
on conflict (id) do nothing;
