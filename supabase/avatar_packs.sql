-- Avatar packs catalog: curated manager avatars with per-user pack unlocks.
-- Run in Supabase SQL editor after manager_avatars_storage.sql.
-- Step 1 of avatar rollout — schema + starter pack row + default grants for new signups.

create table if not exists public.avatar_packs (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text null,
  sort_order int not null default 0,
  is_default boolean not null default false,
  unlock_type text not null default 'free'
    check (unlock_type in ('free', 'purchase', 'achievement', 'admin')),
  created_at timestamptz not null default now()
);

comment on table public.avatar_packs is
  'Curated avatar collections (starter pack, paid packs, XP rewards, etc.).';

create table if not exists public.avatars (
  id uuid primary key default gen_random_uuid(),
  pack_id uuid not null references public.avatar_packs (id) on delete cascade,
  slug text not null,
  label text not null,
  sort_order int not null default 0,
  default_tier int not null default 3 check (default_tier between 1 and 5),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (pack_id, slug)
);

comment on table public.avatars is
  'Avatar character in a pack (e.g. Mika Mooshot). Tier images live in avatar_assets.';

create index if not exists idx_avatars_pack_sort on public.avatars (pack_id, sort_order, label);

create table if not exists public.avatar_assets (
  id uuid primary key default gen_random_uuid(),
  avatar_id uuid not null references public.avatars (id) on delete cascade,
  tier int not null check (tier between 1 and 5),
  asset_type text not null check (asset_type in ('square', 'full')),
  storage_path text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (avatar_id, tier, asset_type)
);

comment on table public.avatar_assets is
  'Performance-tier images per avatar character (square headshot + full body).';

create index if not exists idx_avatar_assets_avatar_tier on public.avatar_assets (avatar_id, tier, asset_type);

create table if not exists public.user_avatar_pack_unlocks (
  user_id uuid not null references auth.users (id) on delete cascade,
  pack_id uuid not null references public.avatar_packs (id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  source text not null default 'default',
  primary key (user_id, pack_id)
);

comment on table public.user_avatar_pack_unlocks is
  'Which avatar packs a user may pick from (starter granted on signup; others earned or purchased).';

create index if not exists idx_user_avatar_pack_unlocks_pack on public.user_avatar_pack_unlocks (pack_id);

alter table public.profiles
  add column if not exists avatar_id uuid null references public.avatars (id) on delete set null,
  add column if not exists needs_avatar_selection boolean not null default false;

comment on column public.profiles.avatar_id is
  'Selected catalog avatar; avatar_url kept in sync during migration.';
comment on column public.profiles.needs_avatar_selection is
  'When true, user must pick an avatar from an unlocked pack before using the app.';

-- Starter pack (avatar rows added in step 2 after storage is organized).
insert into public.avatar_packs (slug, name, description, sort_order, is_default, unlock_type)
values (
  'starter-pack',
  'Starter Pack',
  'Free manager avatars available to every player.',
  0,
  true,
  'free'
)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  is_default = excluded.is_default,
  unlock_type = excluded.unlock_type;

create or replace function public.grant_default_avatar_packs(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user_id is null then
    return;
  end if;

  insert into public.user_avatar_pack_unlocks (user_id, pack_id, source)
  select p_user_id, ap.id, 'default'
  from public.avatar_packs ap
  where ap.is_default = true or ap.slug = 'starter-pack'
  on conflict (user_id, pack_id) do nothing;
end;
$$;

comment on function public.grant_default_avatar_packs(uuid) is
  'Grants all default / starter avatar packs to a user (signup + backfill).';

/* Extend profile creation: grant starter pack on signup. */
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

  insert into public.profiles (id, display_name, timezone, accepted_terms_at, accepted_privacy_at, needs_avatar_selection)
  values (new.id, nullif(trim(initial_name), ''), initial_timezone, accepted_terms, accepted_privacy, true);

  perform public.grant_default_avatar_packs(new.id);

  return new;
end;
$$;

/* Backfill starter-pack unlock for all existing profiles. */
insert into public.user_avatar_pack_unlocks (user_id, pack_id, source)
select p.id, ap.id, 'migration'
from public.profiles p
cross join public.avatar_packs ap
where ap.slug = 'starter-pack'
on conflict (user_id, pack_id) do nothing;

alter table public.avatar_packs enable row level security;
alter table public.avatars enable row level security;
alter table public.avatar_assets enable row level security;
alter table public.user_avatar_pack_unlocks enable row level security;

drop policy if exists "avatar_packs_select_authenticated" on public.avatar_packs;
create policy "avatar_packs_select_authenticated"
  on public.avatar_packs for select
  to authenticated
  using (true);

drop policy if exists "avatars_select_authenticated" on public.avatars;
create policy "avatars_select_authenticated"
  on public.avatars for select
  to authenticated
  using (active = true);

drop policy if exists "avatar_assets_select_authenticated" on public.avatar_assets;
create policy "avatar_assets_select_authenticated"
  on public.avatar_assets for select
  to authenticated
  using (active = true);

drop policy if exists "user_avatar_pack_unlocks_select_own" on public.user_avatar_pack_unlocks;
create policy "user_avatar_pack_unlocks_select_own"
  on public.user_avatar_pack_unlocks for select
  to authenticated
  using (auth.uid() = user_id);
