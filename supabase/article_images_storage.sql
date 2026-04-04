/* Public bucket for news article images (site admin upload via app). Run once in Supabase SQL Editor. */

insert into storage.buckets (id, name, public)
values ('article-images', 'article-images', true)
on conflict (id) do update set public = excluded.public;

/* Anyone can read (news pages are public). */
drop policy if exists "article_images_public_read" on storage.objects;
create policy "article_images_public_read"
  on storage.objects for select
  to public
  using (bucket_id = 'article-images');

/* Site admins upload; first path segment must be their user id (enforced by the API). */
drop policy if exists "article_images_admin_insert" on storage.objects;
create policy "article_images_admin_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'article-images'
    and split_part(name, '/', 1) = auth.uid()::text
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and coalesce(p.is_site_admin, false)
    )
  );

drop policy if exists "article_images_admin_delete" on storage.objects;
create policy "article_images_admin_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'article-images'
    and split_part(name, '/', 1) = auth.uid()::text
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and coalesce(p.is_site_admin, false)
    )
  );
