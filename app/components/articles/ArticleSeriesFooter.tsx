import Link from "next/link";
import { listPublishedArticlesInSeries } from "@/lib/articles";

type Props = {
  seriesSlug: string;
  seriesTitle?: string | null;
  currentSlug: string;
};

function partLabel(p: { title: string; series_part: number | null }): string {
  const prefix = p.series_part != null ? `Part ${p.series_part}: ` : "";
  return `${prefix}${p.title}`;
}

/**
 * After the article body: previous / next in the series plus an optional full list when there are multiple parts.
 */
export async function ArticleSeriesFooter({ seriesSlug, seriesTitle, currentSlug }: Props) {
  const slug = seriesSlug.trim();
  if (!slug) return null;
  const parts = await listPublishedArticlesInSeries(slug);
  if (parts.length < 2) return null;

  const cur = currentSlug.trim();
  const idx = parts.findIndex((p) => p.slug.trim() === cur);
  if (idx < 0) return null;

  const prev = idx > 0 ? parts[idx - 1] : null;
  const next = idx < parts.length - 1 ? parts[idx + 1] : null;
  const label = (seriesTitle ?? "").trim() || "This series";

  return (
    <footer className="news-series-footer" aria-label="More in this article series">
      <p className="news-series-footer-eyebrow">Continue the series</p>
      <h2 className="news-series-footer-title">{label}</h2>
      <div className="news-series-footer-jump">
        <div className="news-series-footer-prev">
          {prev ? (
            <Link
              href={`/news/${encodeURIComponent(prev.slug.trim())}`}
              className="news-series-footer-link app-link"
            >
              <span className="news-series-footer-dir">← Previous</span>
              <span className="news-series-footer-article">{partLabel(prev)}</span>
            </Link>
          ) : (
            <span className="news-series-footer-placeholder" aria-hidden="true" />
          )}
        </div>
        <div className="news-series-footer-next">
          {next ? (
            <Link
              href={`/news/${encodeURIComponent(next.slug.trim())}`}
              className="news-series-footer-link app-link news-series-footer-link-next"
            >
              <span className="news-series-footer-dir">Next →</span>
              <span className="news-series-footer-article">{partLabel(next)}</span>
            </Link>
          ) : (
            <span className="news-series-footer-placeholder" aria-hidden="true" />
          )}
        </div>
      </div>
      {parts.length >= 2 ? (
        <nav className="news-series-footer-all" aria-label="All parts in this series">
          <span className="news-series-footer-all-label">All parts:</span>
          <span className="news-series-footer-all-links">
            {parts.map((p, i) => (
              <span key={p.slug.trim()} className="news-series-footer-all-item">
                {i > 0 ? <span className="news-series-nav-sep"> · </span> : null}
                {p.slug.trim() === cur ? (
                  <span className="news-series-nav-current" aria-current="page">
                    {partLabel(p)}
                  </span>
                ) : (
                  <Link href={`/news/${encodeURIComponent(p.slug.trim())}`} className="app-link">
                    {partLabel(p)}
                  </Link>
                )}
              </span>
            ))}
          </span>
        </nav>
      ) : null}
    </footer>
  );
}
