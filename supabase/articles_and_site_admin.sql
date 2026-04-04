/* Site admin flag + news articles. Run in Supabase SQL editor or via migration. */

alter table public.profiles
  add column if not exists is_site_admin boolean not null default false;

comment on column public.profiles.is_site_admin is 'When true, user may edit site content (articles, future event tools).';

create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  excerpt text null,
  body text not null default '',
  author_id uuid not null references public.profiles (id) on delete restrict,
  byline text null,
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_articles_status_published_at
  on public.articles (status, published_at desc nulls last);

create index if not exists idx_articles_updated_at on public.articles (updated_at desc);

comment on table public.articles is 'Editorial posts (Markdown body). Public reads published rows only.';

comment on column public.articles.byline is
  'Optional public author credit; when null, profiles.display_name for author_id is shown.';

alter table public.articles enable row level security;

create policy "articles_select_published"
  on public.articles for select
  to anon, authenticated
  using (
    status = 'published'
    and published_at is not null
    and published_at <= now()
  );

create policy "articles_select_admin"
  on public.articles for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and coalesce(p.is_site_admin, false)
    )
  );

create policy "articles_insert_admin"
  on public.articles for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and coalesce(p.is_site_admin, false)
    )
    and author_id = auth.uid()
  );

create policy "articles_update_admin"
  on public.articles for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and coalesce(p.is_site_admin, false)
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and coalesce(p.is_site_admin, false)
    )
  );

create policy "articles_delete_admin"
  on public.articles for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and coalesce(p.is_site_admin, false)
    )
  );

create or replace function public.set_articles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists articles_set_updated_at on public.articles;
create trigger articles_set_updated_at
  before update on public.articles
  for each row execute procedure public.set_articles_updated_at();
