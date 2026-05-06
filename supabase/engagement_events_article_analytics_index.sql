-- Speeds up site-admin article analytics (filter by article_slug in metadata).
create index if not exists idx_engagement_events_article_slug
  on public.engagement_events ((metadata ->> 'article_slug'), occurred_at desc)
  where event_name in ('page.news_article_view', 'page.news_article_dwell');
