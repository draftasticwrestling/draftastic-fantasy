import type { ReactNode } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import HubLatestEventPreview from "@/app/components/HubLatestEventPreview";
import { HubLatestArticleCard } from "@/app/components/HubLatestArticleCard";
import { articleFeedThumbnailUrl } from "@/lib/articleFirstImage";
import {
  fetchHubRecentCompleted,
  fetchHubTodayPrimaryEvent,
  fetchHubUpcomingSpotlight,
} from "@/lib/home/hubHomeEvents";
import {
  getCivilYmdInEt,
  hubLatestCompletedResultsShouldPinTop,
  hubLatestIsInShowcasePinWindow,
} from "@/lib/home/hubLatestSchedule";
import { listPublishedArticles, type ArticleRow } from "@/lib/articles";

/** Hub “The latest”: up to four article cards; event vs article order uses `hubLatestSchedule` (8am PT + 12h windows). */
const LATEST_SECTION_ARTICLES = 4;
const HEADLINES_ARTICLE_POOL = 10;
/** Articles + static links (+ optional empty-state row); must not cut off trailing static CTAs */
const HEADLINES_LIST_MAX_ITEMS = HEADLINES_ARTICLE_POOL + 4;

export type HubHeadlineVariant = "hub" | "marketing";

/** `hub-columns`: main + side for the three-column hub. `marketing-rail`: single sidebar (latest + headlines stacked). */
export type HubLatestLayout = "hub-columns" | "marketing-rail";

const MARKETING_RAIL_MAX_FEED = 3;
/** Total headline rows in marketing sidebar (articles first, then static links) */
const MARKETING_RAIL_MAX_HEADLINES = HEADLINES_LIST_MAX_ITEMS;

const HEADLINE_EXCERPT_MAX = 130;

type HubHeadlineItem = {
  href: string;
  label: string;
  /** ISO timestamp for `<time>`; only article rows */
  publishedAt?: string | null;
  excerpt?: string | null;
  /** Article hero / first image; static rows omit */
  imageUrl?: string | null;
};

function clipHeadlineExcerpt(text: string | null | undefined): string | null {
  if (text == null || !text.trim()) return null;
  const one = text.replace(/\s+/g, " ").trim();
  if (one.length <= HEADLINE_EXCERPT_MAX) return one;
  return `${one.slice(0, HEADLINE_EXCERPT_MAX - 1).trimEnd()}…`;
}

function formatHeadlinePublishedDate(iso: string | null | undefined): string | null {
  if (iso == null || !iso.trim()) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/New_York",
  }).format(d);
}

function hubArticleCardEl(a: ArticleRow) {
  return (
    <HubLatestArticleCard
      key={a.id}
      slug={a.slug}
      title={a.title}
      excerpt={a.excerpt}
      publishedAt={a.published_at}
      imageUrl={articleFeedThumbnailUrl(a)}
    />
  );
}

function buildHeadlines(articles: ArticleRow[], variant: HubHeadlineVariant): HubHeadlineItem[] {
  const staticHeadlines: HubHeadlineItem[] =
    variant === "marketing"
      ? [
          { href: "/news", label: "More on the News page" },
          { href: "/event-results", label: "Browse event results & fantasy scoring" },
          { href: "/wrestlers", label: "Wrestler profiles & stats" },
        ]
      : [{ href: "/event-results", label: "Browse all completed events and fantasy scoring" }];

  return [
    ...articles.slice(0, HEADLINES_ARTICLE_POOL).map((a) => ({
      href: `/news/${encodeURIComponent(a.slug)}`,
      label: a.title,
      publishedAt: a.published_at,
      excerpt: clipHeadlineExcerpt(a.excerpt),
      imageUrl: articleFeedThumbnailUrl(a),
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
  ].slice(0, HEADLINES_LIST_MAX_ITEMS);
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
    const [todayPrimary, { data: wrestlersData }, art] = await Promise.all([
      fetchHubTodayPrimaryEvent(supabase),
      supabase.from("wrestlers").select("id, name, image_url"),
      listPublishedArticles(articleLimit),
    ]);
    const upcoming = await fetchHubUpcomingSpotlight(supabase, todayPrimary?.id ?? null);
    const completedRows = await fetchHubRecentCompleted(supabase, 1, todayPrimary?.id ?? null);
    articles = art;
    const wrestlerRows = (wrestlersData ?? []) as { id: string; name: string | null; image_url: string | null }[];
    const latestArticles = articles.slice(0, LATEST_SECTION_ARTICLES);
    const completedEvent = completedRows[0];
    const nowMs = Date.now();
    const etToday = getCivilYmdInEt(nowMs);

    const live =
      todayPrimary != null && (todayPrimary.status || "").toLowerCase().trim() === "live";
    const completedPin =
      Boolean(completedEvent) && hubLatestCompletedResultsShouldPinTop(completedEvent, nowMs);
    const todayInShowcaseWindow =
      todayPrimary != null &&
      !live &&
      todayPrimary.date === etToday &&
      hubLatestIsInShowcasePinWindow(todayPrimary, nowMs);
    const upcomingInWindow =
      upcoming != null ? hubLatestIsInShowcasePinWindow(upcoming, nowMs) : false;

    const hasUpcoming = Boolean(upcoming);
    const hasCompleted = Boolean(completedEvent);
    const hasArticles = latestArticles.length > 0;
    const hubSurfaceAnyEventCard =
      Boolean(todayPrimary) || hasUpcoming || hasCompleted || live || completedPin || todayInShowcaseWindow || upcomingInWindow;
    hasLatestSection = hubSurfaceAnyEventCard || hasArticles;

    const todayEventCard =
      todayPrimary != null ? (
        <HubLatestEventPreview
          key={todayPrimary.id}
          event={todayPrimary}
          wrestlerRows={wrestlerRows}
          variant={live ? "live" : "upcoming"}
          whenLabel={live ? undefined : "Tonight"}
        />
      ) : null;

    const upcomingCard = upcoming ? (
      <HubLatestEventPreview
        key={upcoming.id}
        event={upcoming}
        wrestlerRows={wrestlerRows}
        variant="upcoming"
        whenLabel={upcoming.whenLabel}
      />
    ) : null;

    const completedCard = completedEvent ? (
      <HubLatestEventPreview
        key={completedEvent.id}
        event={completedEvent}
        wrestlerRows={wrestlerRows}
        variant="completed"
      />
    ) : null;

    /** “The latest” ordering: 8am PT + 12h windows (see `lib/home/hubLatestSchedule.ts`). */
    const fullFeedNodes: ReactNode[] = [];
    if (live && todayEventCard) {
      fullFeedNodes.push(todayEventCard);
    } else if (completedPin && completedCard) {
      fullFeedNodes.push(completedCard);
    } else if (todayInShowcaseWindow && todayEventCard) {
      fullFeedNodes.push(todayEventCard);
    } else if (upcomingInWindow && upcomingCard) {
      fullFeedNodes.push(upcomingCard);
    }

    const todayNotInPrimary =
      Boolean(todayEventCard) && !(live || todayInShowcaseWindow);
    const upcomingNotInPrimary = Boolean(upcomingCard) && !upcomingInWindow;
    const completedNotInPrimary = Boolean(completedCard) && !completedPin;

    if (latestArticles[0]) fullFeedNodes.push(hubArticleCardEl(latestArticles[0]));
    if (todayNotInPrimary && todayEventCard) fullFeedNodes.push(todayEventCard);
    if (upcomingNotInPrimary && upcomingCard) fullFeedNodes.push(upcomingCard);
    if (latestArticles[1]) fullFeedNodes.push(hubArticleCardEl(latestArticles[1]));
    if (completedNotInPrimary) fullFeedNodes.push(completedCard!);
    if (latestArticles[2]) fullFeedNodes.push(hubArticleCardEl(latestArticles[2]));
    if (latestArticles[3]) fullFeedNodes.push(hubArticleCardEl(latestArticles[3]));
    feedNodes = fullFeedNodes;

    if (hasCompleted === false && hasUpcoming && upcoming && !hasArticles && !todayPrimary && !live && !completedPin) {
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
    <>
      <ul className="hub-headlines">
        {headlines.map((h, i) => {
          const dateLabel = formatHeadlinePublishedDate(h.publishedAt);
          const showMeta = Boolean(dateLabel || h.excerpt);
          const metaBlock =
            showMeta ? (
              <div className="hub-headlines-art-meta">
                {dateLabel != null && h.publishedAt ? (
                  <time className="hub-headlines-date" dateTime={h.publishedAt}>
                    {dateLabel}
                  </time>
                ) : null}
                {h.excerpt ? <p className="hub-headlines-dek">{h.excerpt}</p> : null}
              </div>
            ) : null;

          const thumb = h.imageUrl?.trim();
          if (thumb) {
            return (
              <li key={`${h.href}-${i}`} className="hub-headlines-li hub-headlines-li--thumb">
                <Link href={h.href} className="hub-headlines-row-link">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={thumb}
                    alt=""
                    className="hub-headlines-thumb"
                    loading="lazy"
                    decoding="async"
                  />
                  <div className="hub-headlines-row-main">
                    <span className="hub-headlines-row-title">{h.label}</span>
                    {metaBlock}
                  </div>
                </Link>
              </li>
            );
          }

          return (
            <li key={`${h.href}-${i}`}>
              <Link href={h.href}>{h.label}</Link>
              {metaBlock}
            </li>
          );
        })}
      </ul>
      {headlineVariant === "hub" ? (
        <p className="hub-headlines-index">
          <Link href="/news">View all news</Link>
        </p>
      ) : null}
    </>
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
