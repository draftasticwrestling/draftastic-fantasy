/* Manager avatars — public bucket. Users may only INSERT/UPDATE/DELETE under {user_id}/...
   Curated choices live under presets/ (admin upload only; see supabase/manager_avatars_presets.sql).
   Run in Supabase SQL Editor after creating the bucket (or rely on insert below).
   If the bucket already exists as "Manager Avatars", align the id in the Dashboard
   or change the id below to match your bucket id. */

insert into storage.buckets (id, name, public)
values ('manager-avatars', 'manager-avatars', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "manager_avatars_public_read" on storage.objects;
create policy "manager_avatars_public_read"
  on storage.objects for select
  to public
  using (bucket_id = 'manager-avatars');

drop policy if exists "manager_avatars_own_insert" on storage.objects;
create policy "manager_avatars_own_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'manager-avatars'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists "manager_avatars_own_update" on storage.objects;
create policy "manager_avatars_own_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'manager-avatars'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists "manager_avatars_own_delete" on storage.objects;
create policy "manager_avatars_own_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'manager-avatars'
    and split_part(name, '/', 1) = auth.uid()::text
  );
