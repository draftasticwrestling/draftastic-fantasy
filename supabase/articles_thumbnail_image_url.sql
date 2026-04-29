-- Optional feed / home card thumbnail: pick which in-body image URL to use for News list + hub.
-- Run in Supabase SQL Editor when deploying this feature.

alter table public.articles
  add column if not exists thumbnail_image_url text null;

comment on column public.articles.thumbnail_image_url is
  'Optional. Must match an image URL used in body Markdown/HTML. When null, the first image in the article body is used for list thumbnails.';
