/* Lock down admin moderation audit with RLS (addresses Supabase Security Advisor error). */

alter table public.admin_moderation_audit enable row level security;
alter table public.admin_moderation_audit force row level security;

drop policy if exists "admin_moderation_audit_select_admin" on public.admin_moderation_audit;
create policy "admin_moderation_audit_select_admin"
  on public.admin_moderation_audit
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and coalesce(p.is_site_admin, false)
    )
  );

drop policy if exists "admin_moderation_audit_insert_admin" on public.admin_moderation_audit;
create policy "admin_moderation_audit_insert_admin"
  on public.admin_moderation_audit
  for insert
  to authenticated
  with check (
    actor_user_id = auth.uid()
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and coalesce(p.is_site_admin, false)
    )
  );
