import type { ReactNode } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import HubLatestEventPreview from "@/app/components/HubLatestEventPreview";
import { HubLatestArticleCard } from "@/app/components/HubLatestArticleCard";
import { firstArticleImageUrl } from "@/lib/articleFirstImage";
import { fetchHubLiveSpotlight, fetchHubRecentCompleted, fetchHubUpcomingSpotlight } from "@/lib/home/hubHomeEvents";
import { listPublishedArticles, type ArticleRow } from "@/lib/articles";

/** Slots: top article + (after upcoming) three more in the interleaved feed. */
const LATEST_SECTION_ARTICLES = 4;
const HEADLINES_ARTICLE_POOL = 5;

export type HubHeadlineVariant = "hub" | "marketing";

/** `hub-columns`: main + side for the three-column hub. `marketing-rail`: single sidebar (latest + headlines stacked). */
export type HubLatestLayout = "hub-columns" | "marketing-rail";

const MARKETING_RAIL_MAX_FEED = 3;
const MARKETING_RAIL_MAX_HEADLINES = 6;

function hubArticleCardEl(a: ArticleRow) {
  return (
    <HubLatestArticleCard
      key={a.id}
      slug={a.slug}
      title={a.title}
      excerpt={a.excerpt}
      publishedAt={a.published_at}
      imageUrl={firstArticleImageUrl(a.body)}
    />
  );
}

function buildHeadlines(articles: ArticleRow[], variant: HubHeadlineVariant) {
  const staticHeadlines =
    variant === "marketing"
      ? [
          { href: "/news", label: "More on the News page" },
          { href: "/event-results", label: "Browse event results & fantasy scoring" },
          { href: "/wrestlers", label: "Wrestler profiles & stats" },
        ]
      : [
          { href: "/fantasy", label: "Play Draftastic Fantasy — create a league with friends" },
          { href: "/event-results", label: "Browse all completed events and fantasy scoring" },
        ];

  return [
    ...articles.slice(0, HEADLINES_ARTICLE_POOL).map((a) => ({
      href: `/news/${encodeURIComponent(a.slug)}`,
      label: a.title,
    })),
    ...(articles.length === 0
      ? [
          {
            href: "/news",
            label: variant === "marketing" ? "News & commentary" : "News — fantasy takes on the week in wrestling",
          },
        ]
      : []),
    ...staticHeadlines,
  ].slice(0, 8);
}

export default async function HubLatestHeadlinesSection({
  headlineVariant,
  layout = "hub-columns",
}: {
  headlineVariant: HubHeadlineVariant;
  layout?: HubLatestLayout;
}) {
  const articleLimit = Math.max(LATEST_SECTION_ARTICLES, HEADLINES_ARTICLE_POOL);

  let articles: ArticleRow[];
  let feedNodes: ReactNode[];
  let hasLatestSection: boolean;
  let latestBlockExtras: ReactNode = null;

  if (layout === "marketing-rail") {
    articles = await listPublishedArticles(Math.max(MARKETING_RAIL_MAX_FEED, HEADLINES_ARTICLE_POOL));
    const railArticles = articles.slice(0, MARKETING_RAIL_MAX_FEED);
    feedNodes = railArticles.map((a) => hubArticleCardEl(a));
    hasLatestSection = railArticles.length > 0;
  } else {
    const supabase = await createClient();
    const [upcoming, liveEvent, { data: wrestlersData }, art] = await Promise.all([
      fetchHubUpcomingSpotlight(supabase),
      fetchHubLiveSpotlight(supabase),
      supabase.from("wrestlers").select("id, name, image_url"),
      listPublishedArticles(articleLimit),
    ]);
    const completedRows = await fetchHubRecentCompleted(supabase, 1, liveEvent?.id ?? null);
    articles = art;
    const wrestlerRows = (wrestlersData ?? []) as { id: string; name: string | null; image_url: string | null }[];
    const latestArticles = articles.slice(0, LATEST_SECTION_ARTICLES);
    const completedEvent = completedRows[0];
    const hasLive = Boolean(liveEvent);
    const hasUpcoming = Boolean(upcoming);
    const hasCompleted = Boolean(completedEvent);
    const hasArticles = latestArticles.length > 0;
    hasLatestSection = hasLive || hasUpcoming || hasCompleted || hasArticles;

    const fullFeedNodes: ReactNode[] = [];
    if (upcoming) {
      fullFeedNodes.push(
        <HubLatestEventPreview
          key={upcoming.id}
          event={upcoming}
          wrestlerRows={wrestlerRows}
          variant="upcoming"
          whenLabel={upcoming.whenLabel}
        />
      );
    }
    if (liveEvent) {
      fullFeedNodes.push(
        <HubLatestEventPreview
          key={liveEvent.id}
          event={liveEvent}
          wrestlerRows={wrestlerRows}
          variant="live"
        />
      );
    }
    if (latestArticles[0]) fullFeedNodes.push(hubArticleCardEl(latestArticles[0]));
    if (latestArticles[1]) fullFeedNodes.push(hubArticleCardEl(latestArticles[1]));
    if (completedEvent) {
      fullFeedNodes.push(
        <HubLatestEventPreview
          key={completedEvent.id}
          event={completedEvent}
          wrestlerRows={wrestlerRows}
          variant="completed"
        />
      );
    }
    if (latestArticles[2]) fullFeedNodes.push(hubArticleCardEl(latestArticles[2]));
    if (latestArticles[3]) fullFeedNodes.push(hubArticleCardEl(latestArticles[3]));
    feedNodes = fullFeedNodes;

    if (hasCompleted === false && hasUpcoming && upcoming && !hasArticles && !hasLive) {
      latestBlockExtras = (
        <p className="hub-muted" style={{ marginTop: 16 }}>
          No completed events to show yet — check back after the show.
        </p>
      );
    }
  }

  const headlineList = buildHeadlines(articles, headlineVariant);
  const headlines =
    layout === "marketing-rail" ? headlineList.slice(0, MARKETING_RAIL_MAX_HEADLINES) : headlineList;

  const latestBlock = (
    <>
      {hasLatestSection ? (
        <>
          <div className="hub-latest-feed">{feedNodes}</div>
          {latestBlockExtras}
        </>
      ) : (
        <p className="hub-muted">No recent updates yet. Check back after the next show or news post.</p>
      )}
    </>
  );

  const headlinesBlock = (
    <ul className="hub-headlines">
      {headlines.map((h, i) => (
        <li key={`${h.href}-${i}`}>
          <Link href={h.href}>{h.label}</Link>
        </li>
      ))}
    </ul>
  );

  if (layout === "marketing-rail") {
    return (
      <aside className="cs-hub-rail" aria-label="News">
        <div className="cs-hub-rail-sticky">
          <section className="cs-hub-rail-section" aria-labelledby="hub-latest-heading">
            <h2 id="hub-latest-heading" className="hub-col-title cs-hub-rail-heading">
              The latest
            </h2>
            {latestBlock}
          </section>
          <section className="cs-hub-rail-section" aria-label="Headlines">
            <h2 className="hub-col-title cs-hub-rail-heading">Top headlines</h2>
            {headlinesBlock}
          </section>
        </div>
      </aside>
    );
  }

  return (
    <>
      <section className="hub-col hub-col-main" aria-labelledby="hub-latest-heading">
        <h2 id="hub-latest-heading" className="hub-col-title">
          The latest
        </h2>
        {latestBlock}
      </section>

      <aside className="hub-col hub-col-side" aria-label="Headlines">
        <h2 className="hub-col-title">Top headlines</h2>
        {headlinesBlock}
      </aside>
    </>
  );
}
