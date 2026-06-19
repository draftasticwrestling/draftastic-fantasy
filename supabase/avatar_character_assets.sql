-- Avatar characters + tier assets (migration from per-file avatars rows).
-- Run after supabase/avatar_packs.sql.
-- Safe to re-run.

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

alter table public.avatars
  add column if not exists default_tier int not null default 3;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'avatars_default_tier_check'
      and conrelid = 'public.avatars'::regclass
  ) then
    alter table public.avatars
      add constraint avatars_default_tier_check check (default_tier between 1 and 5);
  end if;
end $$;

comment on table public.avatars is
  'Avatar character in a pack (e.g. Mika Mooshot). Images live in avatar_assets.';

comment on column public.avatars.default_tier is
  'Baseline performance tier for picker + display until dynamic tier logic ships.';

-- Step 1 stored one row per image file; clear those before character-based seeding.
update public.profiles set avatar_id = null where avatar_id is not null;

delete from public.avatar_assets;
delete from public.avatars;

alter table public.avatars drop column if exists storage_path;

alter table public.avatar_assets enable row level security;

drop policy if exists "avatar_assets_select_authenticated" on public.avatar_assets;
create policy "avatar_assets_select_authenticated"
  on public.avatar_assets for select
  to authenticated
  using (active = true);
