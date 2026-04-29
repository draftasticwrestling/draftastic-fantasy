import { createClient } from "@/lib/supabase/server";

/**
 * Use * so older DBs without `byline` still load; requesting a missing column makes
 * Supabase error and callers that do `if (error) return []` hide every article.
 */
const ARTICLE_SELECT = "*";

export type ArticleRow = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body: string;
  author_id: string;
  /** Present after `articles_add_byline.sql`; public byline override */
  byline?: string | null;
  /** After `articles_series.sql`: multi-part story grouping */
  series_slug?: string | null;
  series_title?: string | null;
  series_part?: number | null;
  /** After `articles_thumbnail_image_url.sql`: feed / home card image (must match a URL in body) */
  thumbnail_image_url?: string | null;
  status: "draft" | "published";
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type SeriesArticleTeaser = {
  slug: string;
  title: string;
  series_part: number | null;
};

/**
 * Published articles sharing a series_slug, ordered for nav (oldest `published_at` first).
 */
export async function listPublishedArticlesInSeries(seriesSlug: string): Promise<SeriesArticleTeaser[]> {
  const raw = seriesSlug?.trim();
  if (!raw) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("articles")
    .select("slug, title, series_part, published_at")
    .eq("status", "published")
    .not("published_at", "is", null)
    .eq("series_slug", raw)
    .lte("published_at", new Date().toISOString());
  if (error || !data) return [];
  const rows = data as {
    slug: string;
    title: string;
    series_part: number | null;
    published_at: string;
  }[];
  // Oldest `published_at` first so Prev/Next follows release order. `series_part` is for labels only.
  // Tie-breaker: part number (so same-timestamp posts still order 1, 2, 3).
  rows.sort((a, b) => {
    const t = a.published_at.localeCompare(b.published_at);
    if (t !== 0) return t;
    const ap = a.series_part ?? 999_999;
    const bp = b.series_part ?? 999_999;
    return ap - bp;
  });
  return rows.map(({ slug, title, series_part }) => ({ slug, title, series_part }));
}

export async function listPublishedArticles(limit = 50): Promise<ArticleRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("articles")
    .select(ARTICLE_SELECT)
    .eq("status", "published")
    .not("published_at", "is", null)
    .lte("published_at", new Date().toISOString())
    .order("published_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []) as ArticleRow[];
}

export async function getPublishedArticleBySlug(slug: string): Promise<ArticleRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("articles")
    .select(ARTICLE_SELECT)
    .eq("slug", slug)
    .eq("status", "published")
    .not("published_at", "is", null)
    .lte("published_at", new Date().toISOString())
    .maybeSingle();
  if (error || !data) return null;
  return data as ArticleRow;
}

export async function listAllArticlesForAdmin(): Promise<ArticleRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("articles")
    .select(ARTICLE_SELECT)
    .order("updated_at", { ascending: false });
  if (error) return [];
  return (data ?? []) as ArticleRow[];
}

export async function getArticleByIdForAdmin(id: string): Promise<ArticleRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("articles")
    .select(ARTICLE_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return data as ArticleRow;
}

export function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
}

export function isValidArticleSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length <= 96;
}
