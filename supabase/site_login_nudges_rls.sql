-- One-time hardening for existing environments:
-- enable RLS and add a read policy for authenticated users.

alter table public.site_login_nudges enable row level security;

drop policy if exists "Site login nudges are viewable by authenticated users" on public.site_login_nudges;
create policy "Site login nudges are viewable by authenticated users"
  on public.site_login_nudges for select
  to authenticated
  using (true);
