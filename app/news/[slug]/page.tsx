import Link from "next/link";
import { notFound } from "next/navigation";
import {
  autolinkWrestlersInMarkdown,
  getCachedWrestlerAutolinkEntries,
} from "@/lib/articleWrestlerAutolink";
import { getPublishedArticleBySlug } from "@/lib/articles";
import { createClient } from "@/lib/supabase/server";
import { ArticleMarkdown } from "@/app/components/articles/ArticleMarkdown";
import { ArticleSeriesFooter } from "@/app/components/articles/ArticleSeriesFooter";

export const revalidate = 120;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = await getPublishedArticleBySlug(slug);
  if (!article) return { title: "Article — Draftastic" };
  return {
    title: `${article.title} — Draftastic`,
    description: article.excerpt ?? article.title,
  };
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default async function NewsArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = await getPublishedArticleBySlug(slug);
  if (!article) notFound();

  const autolinkEntries = await getCachedWrestlerAutolinkEntries();
  const bodyMarkdown = autolinkWrestlersInMarkdown(article.body || "", autolinkEntries);

  const creditFromArticle = article.byline?.trim();
  let byline = creditFromArticle ?? "";
  if (!byline) {
    const supabase = await createClient();
    const { data: author } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", article.author_id)
      .maybeSingle();
    byline =
      (author as { display_name?: string | null } | null)?.display_name?.trim() || "Draftastic";
  }

  return (
    <main className="app-page news-article-page">
      <p style={{ marginBottom: 16 }}>
        <Link href="/news" className="app-link">← News</Link>
      </p>
      <article>
        <header className="news-article-header">
          <h1 className="news-article-title">{article.title}</h1>
          <p className="news-article-byline">
            {formatDate(article.published_at)} · {byline}
          </p>
          {article.excerpt ? (
            <p className="news-article-deck">{article.excerpt}</p>
          ) : null}
        </header>
        <ArticleMarkdown markdown={bodyMarkdown.trim() ? bodyMarkdown : "_No body yet._"} />
        {article.series_slug?.trim() ? (
          <ArticleSeriesFooter
            seriesSlug={article.series_slug.trim()}
            seriesTitle={article.series_title}
            currentSlug={article.slug}
          />
        ) : null}
      </article>
    </main>
  );
}
