import { createClient } from "@/lib/supabase/server";

export type ArticleRow = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body: string;
  author_id: string;
  status: "draft" | "published";
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export async function listPublishedArticles(limit = 50): Promise<ArticleRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("articles")
    .select(
      "id, slug, title, excerpt, body, author_id, status, published_at, created_at, updated_at"
    )
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
    .select(
      "id, slug, title, excerpt, body, author_id, status, published_at, created_at, updated_at"
    )
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
    .select(
      "id, slug, title, excerpt, body, author_id, status, published_at, created_at, updated_at"
    )
    .order("updated_at", { ascending: false });
  if (error) return [];
  return (data ?? []) as ArticleRow[];
}

export async function getArticleByIdForAdmin(id: string): Promise<ArticleRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("articles")
    .select(
      "id, slug, title, excerpt, body, author_id, status, published_at, created_at, updated_at"
    )
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
