import Link from "next/link";
import type { BreakingNewsItem } from "@/lib/breakingNews";

type Props = {
  items: BreakingNewsItem[];
};

function BreakingNewsEntry({ item }: { item: BreakingNewsItem }) {
  const label = item.linkLabel?.trim() || "Read more";
  if (item.linkHref?.trim()) {
    const href = item.linkHref.trim();
    const external = href.startsWith("http://") || href.startsWith("https://");
    return (
      <>
        <span className="breaking-news-message">{item.message}</span>
        {external ? (
          <a href={href} className="breaking-news-link" target="_blank" rel="noopener noreferrer">
            {label}
          </a>
        ) : (
          <Link href={href} className="breaking-news-link">
            {label}
          </Link>
        )}
      </>
    );
  }

  return <span className="breaking-news-message">{item.message}</span>;
}

export default function BreakingNewsBanner({ items }: Props) {
  if (!items.length) return null;

  const shouldScroll = items.length > 1 || items.some((item) => item.message.length > 72);

  return (
    <aside className="breaking-news-bar" aria-label="Breaking news">
      <div className="breaking-news-bar-inner">
        <span className="breaking-news-label">
          <span className="breaking-news-label-dot" aria-hidden />
          Breaking News
        </span>
        <div className={`breaking-news-track${shouldScroll ? " breaking-news-track--scroll" : ""}`}>
          <div className="breaking-news-track-inner">
            {items.map((item, index) => (
              <span key={item.id} className="breaking-news-item">
                <BreakingNewsEntry item={item} />
                {index < items.length - 1 ? (
                  <span className="breaking-news-sep" aria-hidden>
                    •
                  </span>
                ) : null}
              </span>
            ))}
            {shouldScroll
              ? items.map((item, index) => (
                  <span key={`${item.id}-dup-${index}`} className="breaking-news-item" aria-hidden>
                    <BreakingNewsEntry item={item} />
                    {index < items.length - 1 ? (
                      <span className="breaking-news-sep" aria-hidden>
                        •
                      </span>
                    ) : null}
                  </span>
                ))
              : null}
          </div>
        </div>
      </div>
    </aside>
  );
}
