import Link from "next/link";
import { listPublishedArticles } from "@/lib/articles";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "News — Draftastic",
  description: "Fantasy wrestling commentary and articles.",
};

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function NewsPage() {
  const articles = await listPublishedArticles(60);

  return (
    <main className="app-page news-list-page">
      <p style={{ marginBottom: 16 }}>
        <Link href="/" className="app-link">← Home</Link>
      </p>
      <h1 style={{ fontSize: "1.75rem", marginBottom: 8 }}>News</h1>
      <p style={{ color: "var(--color-text-muted)", lineHeight: 1.6, marginBottom: 28 }}>
        Fantasy-focused takes on pro wrestling — results, strategy, and the road to the big shows.
      </p>

      {articles.length === 0 ? (
        <p style={{ color: "var(--color-text-muted)" }}>
          No articles yet. Check back soon.
        </p>
      ) : (
        <ul className="news-list">
          {articles.map((a) => (
            <li key={a.id} className="news-list-item">
              <Link href={`/news/${encodeURIComponent(a.slug)}`} className="news-list-title">
                {a.title}
              </Link>
              <div className="news-list-meta">{formatDate(a.published_at)}</div>
              {a.excerpt ? (
                <p className="news-list-excerpt">{a.excerpt}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
