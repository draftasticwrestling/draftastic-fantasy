/**
 * One-time Supabase migration for guest author names on news articles.
 * Shown in site admin when save fell back without byline; keep in sync with
 * supabase/articles_add_byline.sql.
 */
export const ARTICLE_BYLINE_MIGRATION_SQL = `alter table public.articles
  add column if not exists byline text null;

comment on column public.articles.byline is
  'Optional name shown as article author on /news. When null, uses profiles.display_name for author_id.';

notify pgrst, 'reload schema';`;
