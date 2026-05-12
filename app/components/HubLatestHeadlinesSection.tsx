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
      imageUrl={articleFeedThumbnailUrl(a)}
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
