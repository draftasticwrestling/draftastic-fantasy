-- Restore site-admin manager avatars cleared by avatar_needs_selection_migration.
-- Admin-only assets live in manager-avatars/presets/admin-only/.
-- Safe to re-run.

update public.profiles
set
  avatar_url = 'https://qvbqxietcmweltxoonvh.supabase.co/storage/v1/object/public/manager-avatars/presets/admin-only/kayfabe-king.png',
  needs_avatar_selection = false
where id = 'a7d23655-163c-4726-9435-fee99693d51f'
  and coalesce(is_site_admin, false) = true;

update public.profiles
set
  avatar_url = 'https://qvbqxietcmweltxoonvh.supabase.co/storage/v1/object/public/manager-avatars/presets/admin-only/km-punk.png',
  needs_avatar_selection = false
where id = 'e0efc9d7-4cb7-4226-aac9-6d21a222bc02'
  and coalesce(is_site_admin, false) = true;

update public.profiles
set
  avatar_url = 'https://qvbqxietcmweltxoonvh.supabase.co/storage/v1/object/public/manager-avatars/presets/admin-only/dillster.png',
  needs_avatar_selection = false
where id = '427d44a2-018c-469d-977d-df63bdaf9b99'
  and coalesce(is_site_admin, false) = true;
