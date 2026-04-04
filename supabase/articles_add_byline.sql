/* Add optional author credit for news articles.
   Same statements as lib/articleBylineMigrationSql.ts (keep in sync).
   Run in Supabase → SQL Editor. */

alter table public.articles
  add column if not exists byline text null;

comment on column public.articles.byline is
  'Optional name shown as article author on /news. When null, uses profiles.display_name for author_id.';

notify pgrst, 'reload schema';
