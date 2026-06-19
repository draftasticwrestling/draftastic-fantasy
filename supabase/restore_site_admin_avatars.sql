-- Restore site-admin manager avatars cleared by avatar_needs_selection_migration.
-- Admin-only assets live in manager-avatars/presets/admin-only/.
-- Safe to re-run.

update public.profiles
set
  avatar_url = 'https://qvbqxietcmweltxoonvh.supabase.co/storage/v1/object/public/manager-avatars/presets/admin-only/kayfabe-king.png',
  needs_avatar_selection = false
where id = 'a7d23655-163c-4726-9435-fee99693d51f'
  and coalesce(is_site_admin, false) = true;
