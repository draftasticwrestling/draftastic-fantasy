import Link from "next/link";

type Props = {
  slug: string;
  title: string;
  excerpt: string | null;
  publishedAt: string | null;
  imageUrl: string | null;
};

function formatBarDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Large hub feed card (ESPN-style): label bar, hero image, headline + optional deck.
 */
export function HubLatestArticleCard({ slug, title, excerpt, publishedAt, imageUrl }: Props) {
  const href = `/news/${encodeURIComponent(slug)}`;
  const bar = ["News", formatBarDate(publishedAt), "Draftastic"].filter(Boolean).join(" · ");

  return (
    <Link href={href} className="hub-article-feed-card">
      <div className="hub-article-feed-bar">
        <span className="hub-article-feed-bar-text">{bar}</span>
      </div>
      <div className="hub-article-feed-media">
        {imageUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={imageUrl}
            alt=""
            className="hub-article-feed-img"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="hub-article-feed-media-ph" aria-hidden="true" />
        )}
      </div>
      <div className="hub-article-feed-body">
        <h3 className="hub-article-feed-title">{title}</h3>
        {excerpt?.trim() ? <p className="hub-article-feed-deck">{excerpt.trim()}</p> : null}
        <span className="hub-article-feed-cta">Read article →</span>
      </div>
    </Link>
  );
}
