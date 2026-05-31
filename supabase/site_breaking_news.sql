-- Homepage breaking news chyron (site admin managed).

create table if not exists public.site_breaking_news (
  id uuid primary key default gen_random_uuid(),
  message text not null,
  link_href text null,
  link_label text null,
  enabled boolean not null default true,
  sort_order integer not null default 0,
  starts_at timestamptz null,
  ends_at timestamptz null,
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint site_breaking_news_message_len check (char_length(message) <= 500),
  constraint site_breaking_news_link_label_len check (link_label is null or char_length(link_label) <= 80),
  constraint site_breaking_news_link_href_len check (link_href is null or char_length(link_href) <= 512)
);

create index if not exists idx_site_breaking_news_sort
  on public.site_breaking_news (enabled, sort_order asc, created_at desc);

comment on table public.site_breaking_news is
  'Breaking news ticker on the public homepage. Admin writes via service role; public reads enabled rows.';

alter table public.site_breaking_news enable row level security;

drop policy if exists "site_breaking_news_select_enabled" on public.site_breaking_news;
create policy "site_breaking_news_select_enabled"
  on public.site_breaking_news for select
  using (enabled = true);

create or replace function public.set_site_breaking_news_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists site_breaking_news_set_updated_at on public.site_breaking_news;
create trigger site_breaking_news_set_updated_at
  before update on public.site_breaking_news
  for each row execute procedure public.set_site_breaking_news_updated_at();
