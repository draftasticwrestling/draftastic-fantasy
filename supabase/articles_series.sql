/* Optional series grouping for news articles (run in Supabase SQL Editor). */

alter table public.articles
  add column if not exists series_slug text null;

alter table public.articles
  add column if not exists series_title text null;

alter table public.articles
  add column if not exists series_part int null;

comment on column public.articles.series_slug is
  'Shared key for a multi-part story; use the same slug on each article in the series.';

comment on column public.articles.series_title is
  'Optional display label shown in the series nav (e.g. Dillster Big Board).';

comment on column public.articles.series_part is
  'Optional part number for ordering in the series nav (1, 2, 3…).';

create index if not exists idx_articles_series_published
  on public.articles (series_slug, series_part nulls last, published_at)
  where series_slug is not null and status = 'published';
